
Leaflet-Looker
This custom visualization was written in Typescript.  It creates lines between points when they are hovered over (or clicked on mobile).  It also stores the current view window, even if some data is outside the window.  

Source Code
The source code is hosted on github:  https://github.com/bytecodeio/leaflet-looker
If you find a bug or have a feature request, please feel free to submit it as an issue to the repo; I may get to it as time allows.  If you wish to develop, change and compile the code, you can download the code and run ‘webpack’ or ‘npm run build’ from the ‘leaflet-looker’ directory.  

Hosting
Once compiled, the code results in an index.js file.  This file may be hosted anywhere.  I currently host this on a private AWS S3 instance, but it will only be there temporarily.  The address is https://leaflet-looker.s3-us-west-2.amazonaws.com/index.js   Copying this file and privately hosting it is all that is required to use the visualization.

Using in Looker
To add the custom visualization to your looker instance, follow the directions here:  https://docs.looker.com/admin-options/platform/visualizations
The visualization requires a ‘location’ field in an explore.  Within looker, you can change the default point color, line color, and point size.  Adding a ‘color’ field with html color codes as a column should color points individually. 
