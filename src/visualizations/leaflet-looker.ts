// eslint-disable
import "leaflet";
import "../leaflet/leaflet.scss";
import isEqual from "lodash.isequal";
import { Looker, VisualizationDefinition } from "../common/types";

const L = window["L"];

// Global values provided via the API
declare var looker: Looker;

// These are used to determine when the mouse moves off of a circle
let currentPoint;
let currentRadius;

interface VoronoiMap extends VisualizationDefinition {}

// initializing and drawing first map, before we have any data.
// this initial location bounds the US.
let dataBounds = [[49, -126], [24, -65]];
const setDataBounds = newBounds => (dataBounds = newBounds);

let countRenders = 0;
const initialRenders = 10;

// Initialize the map.
let map = new L.Map("vis")
  .fitBounds(dataBounds)
  .on("mousemove", onMouseMoveAction);

// Having layer variables declared in this scope makes it easier to unmount.
let pointsLayer;
let voronoiLayer;

const vis: VoronoiMap = {
  id: "voronoi",
  label: "voronoi",
  options: {
    pointColor: {
      type: "string",
      section: "Style",
      default: "#000000",
      label: "Point Color",
      display: "color"
    },
    pointRadius: {
      min: 1,
      max: 20,
      step: 1,
      default: 3,
      type: "number",
      section: "Style",
      label: "Point Radius",
      display: "range"
    },
    lineColor: {
      type: "string",
      section: "Style",
      default: "#FF0000",
      label: "Line Color",
      display: "color"
    },
    zoomLevel: {
      min: 1,
      max: 20,
      step: 1,
      default: 3,
      type: "number",
      section: "Windowing",
      label: "Zoom Level",
      display: "range"
    },
    lat: {
      min: -90,
      max: 90,
      step: 1,
      default: 0,
      type: "number",
      section: "Windowing",
      label: "Zoom Level",
      display: "range"
    },
    lng: {
      min: -180,
      max: 180,
      step: 1,
      default: 0,
      type: "number",
      section: "Windowing",
      label: "Zoom Level",
      display: "range"
    }
  },
  // Set up the initial state of the visualization
  create: function(element, config) {
    // set default props:
    if (typeof config.pointColor != "string") {
      config.pointColor = this.options.pointColor.default;
    }
    if (
      typeof config.pointRadius != "number" ||
      config.pointRadius == this.options.pointRadius.max
    ) {
      config.pointRadius = this.options.pointRadius.default;
    }
    if (typeof config.lineColor != "string") {
      config.lineColor = this.options.lineColor.default;
    }

    // create the tile layer with correct attribution
    var osmUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    var osmAttrib =
      'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors';
    var osm = new L.TileLayer(osmUrl, {
      minZoom: 4,
      maxZoom: 20,
      attribution: osmAttrib
    });
    map.addLayer(osm);
    map.on("zoomanimevent", e => onZoomAnimEventAction(e, this));
  },

  // Render in response to the data
  update: function(data, element, config, queryResponse) {
    const [bounds, minLat, minLong, maxLat, maxLong] = getDataBounds(data);
    map.fitBounds(bounds);
    if (countRenders <= initialRenders) {
      map.fitBounds(bounds);
      countRenders++;
    }

    setDataBounds(bounds);

    addPoints(
      simplePointData(data),
      map,
      config.pointColor,
      config.pointRadius,
      data,
      config.lineColor
    );
  }
};

// convert to simple points for voronoi calculation
const simplePointData = data => data.map(x => x["users.location"].value);

// Using bounds helps optimize the voronoi
const getDataBounds = data => {
  const lats = simplePointData(data).map(x => x[0]);
  const longs = simplePointData(data).map(x => x[1]);
  const minLat = Math.min(...lats);
  let minLong = Math.min(...longs);
  let maxLat = Math.max(...lats);
  let maxLong = Math.max(...longs);

  const dataBounds = [[maxLat, minLong], [minLat, maxLong]];
  return [dataBounds, minLat, minLong, maxLat, maxLong];
};

const findSourceDataPoint = (latlng, fullData) => {
  const filterString = `${latlng.lat},${latlng.lng}`;
  return fullData.find(
    point => filterString === point["users.location"].filterable_value
  );
};

function addPoints(data, map, pointColor, pointRadius, fullData, lineColor) {
  pointsLayer && map.removeLayer(pointsLayer);

  var popupOptions = { maxWidth: 500 };
  var popupContent = (latlng, fullData) =>
    "<h3> Source data: </h3>" +
    "<pre>" +
    JSON.stringify(findSourceDataPoint(latlng, fullData), null, 2) +
    "</pre>";

  pointsLayer = L.layerGroup(
    data.map(function(v) {
      return L.circleMarker(L.latLng(v), {
        radius: pointRadius || 5,
        color: pointColor,
        stroke: false,
        fill: true,
        fillColor: pointColor,
        fillOpacity: 0.4,
        interactive: true
      })
        .on("mouseover", e => onHoverAction(e, lineColor, data))
        .on("click", e => onHoverAction(e, lineColor, data))
        .bindPopup(x => popupContent(x._latlng, fullData), popupOptions);
    })
  );
  map.addLayer(pointsLayer, "points");
}

function onHoverAction(e, color, data) {
  // reset the layer when hovering on a new point.
  voronoiLayer && map.removeLayer(voronoiLayer);

  const lat = e.target._latlng.lat;
  const lng = e.target._latlng.lng;
  const visiblePoints = data.filter(point => {
    if (point[0] === lat && point[1] === lng) return false;
    const latlng = L.latLng(point[0], point[1]);
    return map.getBounds().contains(latlng);
  });
  const allLines = visiblePoints.map(point => {
    return [[lat, lng], [point[0], point[1]]];
  });
  if (allLines.length > 0) {
    voronoiLayer = L.polyline(allLines, { color: color });
    map.addLayer(voronoiLayer, "voronoiLines");
    currentPoint = e.containerPoint;
    currentRadius = e.target.options.radius;
  }
}

function isMouseWithinRadius(e, currentPoint, currentRadius) {
  const dx2 = Math.pow(currentPoint.x - e.containerPoint.x, 2);
  const dy2 = Math.pow(currentPoint.y - e.containerPoint.y, 2);
  const distance = Math.pow(dx2 + dy2, 0.5);
  return distance <= currentRadius;
}

function onMouseMoveAction(e) {
  if (currentPoint && !isMouseWithinRadius(e, currentPoint, currentRadius)) {
    currentPoint = null;
    map.removeLayer(voronoiLayer);
  }
}

function onZoomAnimEventAction(e, viz) {
  console.dir(e);
  console.dir(viz);
  if (!isEqual(e.zoom, viz.config.zoom)) {
    map.trigger("updateConfig", [{ zoom: e.zoom }]);
  }
  if (
    !isEqual(e.center.lat, viz.config.lat) ||
    !isEqual(e.center.lng, viz.config.lng)
  ) {
    map.trigger("updateConfig", [{ lat: e.center.lat }, { lng: e.center.lng }]);
  }
}

looker.plugins.visualizations.add(vis);
