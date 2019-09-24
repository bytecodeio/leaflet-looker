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

// These are used to track the current zoom and positioning of the map
let oldZoom;
let oldLat;
let oldLng;

// This is to check if the initial configs come through, 
// which happens on the 4th update or so, it depends.  It's tricky.
let isInitialized = false;

interface LeafletMap extends VisualizationDefinition {}

// initializing and drawing first map, before we have any data.
// this initial location bounds the US.
let dataBounds = [[49, -126], [24, -65]];

// Initialize the map.
let map = new L.Map("vis")
  .fitBounds(dataBounds)
  .on("mousemove", onMouseMoveAction);

// Having layer variables declared in this scope makes it easier to unmount.
let pointsLayer;
let linesLayer;

const vis: LeafletMap = {
  id: "leaflet",
  label: "leaflet",
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
    zoom: {
      min: 1,
      max: 20,
      step: 1,
      default: 4,
      type: "number",
      section: "Windowing",
      label: "Zoom Level",
      display: "range"
    },
    lat: {
      min: -90,
      max: 90,
      step: 0.000001,
      default: 0,
      type: "number",
      section: "Windowing",
      label: "Latitude",
      display: "range"
    },
    lng: {
      min: -180,
      max: 180,
      step: 0.000001,
      default: 0,
      type: "number",
      section: "Windowing",
      label: "Longitude",
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
      minZoom: 2,
      maxZoom: 20,
      attribution: osmAttrib
    });
    map.addLayer(osm);

    // bind action tracking for zoom and movement
    map.on("zoomend", () => onZoomEndAction(this));
    map.on("moveend", () => onMoveEndAction(this));
  },

  // Render in response to the data
  update: function(data, element, config, queryResponse) {
    // const [bounds, minLat, minLong, maxLat, maxLong] = getDataBounds(data);


    if (!isInitialized && config.zoom) {
      
    map.flyTo(L.latLng(config.lat, config.lng), config.zoom);
isInitialized = true;
    }

    // if this is the first render, update the zoom with the stored parameters
    // if (!oldLat && !oldLng && config.lat === 0 && config.lng === 0) {
    // } else if (config.lat === 0 && config.lng === 0) {
    //   setDataBounds(getDataBounds(data)[0]);
    // }

    if (config.lat !== oldLat) oldLat = config.lat;
    if (config.lng !== oldLng) oldLng = config.lng;
    if (config.zoom !== oldZoom) oldZoom = config.zoom;

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

// Helper function to convert to simple points if necessary
const simplePointData = data => data.map(x => x["users.location"].value);

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
        color: v.color || pointColor,
        stroke: false,
        fill: true,
        fillColor: v.color || pointColor,
        fillOpacity: 0.4,
        interactive: true
      })
        .on("mouseover", e => onHoverAction(e, v.color || lineColor, data))
        .on("click", e => onHoverAction(e, v.color || lineColor, data))
        .bindPopup(x => popupContent(x._latlng, fullData), popupOptions);
    })
  );
  map.addLayer(pointsLayer, "points");
}

function onHoverAction(e, color, data) {
  // reset the layer when hovering on a new point.
  linesLayer && map.removeLayer(linesLayer);

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
    linesLayer = L.polyline(allLines, { color: color });
    map.addLayer(linesLayer, "voronoiLines");
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
    map.removeLayer(linesLayer);
  }
}

function onZoomEndAction(viz) {
  if (!isEqual(map.getZoom(), oldZoom)) {
    viz.trigger("updateConfig", [{ zoom: map.getZoom() }]);
  }
}

function onMoveEndAction(viz) {
  const newLat = map.getCenter().lat;
  const newLng = map.getCenter().lng;

  if (!isEqual(newLat, oldLat) || !isEqual(newLng, oldLng)) {
    viz.trigger("updateConfig", [{ lat: newLat, lng: newLng }]);
  }
}

looker.plugins.visualizations.add(vis);
