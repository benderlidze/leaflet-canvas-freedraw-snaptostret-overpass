class DrawStreets {
    constructor({
        mapContainer,
        canvasContainer,
        drawModeButton,
        panModeButton,
        editModeButton,
        saveButton,
        loadButton
    }) {

        this.mode = 'pan'
        this.mapContainer = mapContainer
        this.canvasContainer = canvasContainer
        this.drawModeButton = drawModeButton
        this.panModeButton = panModeButton
        this.editModeButton = editModeButton
        this.saveButton = saveButton
        this.loadButton = loadButton

        this.geojsonFeature = {}
        this.map = {}
        this.simplifiedLine = {}

        this.drawnItems = {}
    }

    init() {

        const drawMode = document.querySelector(this.drawModeButton)
        const panMode = document.querySelector(this.panModeButton)
        const saveData = document.querySelector(this.saveButton)
        const loadData = document.querySelector(this.loadButton)

        const LAT_LNG = [43.66005063334696, -79.4586181640625];
        const TILE_URL = 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}@2x.png';

        this.map = new L.Map(document.querySelector(this.mapContainer), { doubleClickZoom: false })
            .setView(LAT_LNG, 18);
        L.tileLayer(TILE_URL).addTo(this.map);

        //edit controls
        this.drawnItems = new L.FeatureGroup();
        this.map.addLayer(this.drawnItems);
        var drawControl = new L.Control.Draw({
            position: 'topright',
            draw: {
                polygon: {
                    shapeOptions: {
                        color: 'purple'
                    },
                    allowIntersection: false,
                    drawError: {
                        color: 'orange',
                        timeout: 1000
                    },
                    showArea: true,
                    metric: false,
                    repeatMode: true
                },
                polyline: {
                    shapeOptions: {
                        color: 'red'
                    },
                },
                rect: {
                    shapeOptions: {
                        color: 'green'
                    },
                },
                circle: {
                    shapeOptions: {
                        color: 'steelblue'
                    },
                },

            },
            edit: {
                featureGroup: this.drawnItems
            }
        });
        this.map.addControl(drawControl);
        this.map.on('draw:created', function (e) {
            var type = e.layerType,
                layer = e.layer;

            this.drawnItems.addLayer(layer);
        });

        this.map.on("draw:editstop", (e) => {
            let layers = e.layers;
            console.log('draw:editstop', e, layers);
            console.log('this.drawnItems', this.drawnItems);

            this.saveData(this.drawnItems.toGeoJSON())
        });



        this.map.whenReady(() => this.draw())

        drawMode.addEventListener("click", () => {
            this.map.dragging.disable();
            this.mode = 'draw'
            this.fetchData().then(i => {
                this.geojsonFeature = i;
                L.geoJSON(this.geojsonFeature).addTo(this.map);
            });
        })
        panMode.addEventListener("click", () => {
            this.map.dragging.enable();
            this.mode = 'pan'
        })

        saveData.addEventListener("click", () => {
            console.log('SAVE DATA');
            console.log('this.geojsonFeature', this.simplifiedLine);
            this.saveData(this.simplifiedLine)
        })

        loadData.addEventListener("click", () => {
            this.loadData()
        })
    }

    draw() {
        //Canvas
        console.log('', this, this.canvasContainer);
        var canvas = document.querySelector(this.canvasContainer);
        canvas.style.position = 'relative'
        canvas.style.zIndex = '1001'
        canvas.style.pointerEvents = 'none'
        var ctx = canvas.getContext('2d');
        //Variables
        var canvasx = canvas.offsetLeft;
        var canvasy = canvas.offsetTop;
        var last_mousex = 0
        var last_mousey = 0
        var mousex = 0
        var mousey = 0
        var mousedown = false;
        var tooltype = 'draw';

        this.map.getContainer().append(canvas)

        const mouseDown = event => {

            if (this.mode !== "draw") return;
            const mainLine = []
            const point = this.map.mouseEventToContainerPoint(event.originalEvent);
            this.map.containerPointToLatLng(point)
            last_mousex = point.x
            last_mousey = point.y


            const mouseMove = event => {

                // Resolve the pixel point to the latitudinal and longitudinal equivalent.
                const point = this.map.mouseEventToContainerPoint(event.originalEvent);
                // Push each lat/lng value into the points set.
                const latlng = this.map.containerPointToLatLng(point)
                // console.log('latlng', latlng);

                var pt = turf.point([latlng.lng, latlng.lat]);
                var snapped = turf.nearestPointOnLine(this.geojsonFeature, pt, { units: 'kilometers' });
                // console.log('snapped', snapped);

                if (snapped.properties.dist < 0.1) {
                    mainLine.push(snapped.geometry.coordinates)
                } else {
                    mainLine.push([latlng.lng, latlng.lat])
                }

                mousex = point.x;
                mousey = point.y;

                ctx.beginPath();
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 3;
                ctx.moveTo(last_mousex, last_mousey);
                ctx.lineTo(mousex, mousey);
                ctx.lineJoin = ctx.lineCap = 'round';
                ctx.stroke();
                //lineIterator(new Point(point.x, point.y));
                last_mousex = mousex;
                last_mousey = mousey;
            };

            // Create the path when the user moves their cursor.
            this.map.on('mousemove touchmove', mouseMove);

            const mouseUp = (_, create = true) => {
                // Stop listening to the events.
                this.map.off('mouseup', mouseUp);
                this.map.off('mousemove', mouseMove);
                'body' in document && document.body.removeEventListener('mouseleave', mouseUp);

                const geo = turf.lineString(mainLine)
                var myStyle = {
                    "color": "red",
                    "weight": 5,
                    "opacity": 0.65
                };
                var linesFeatureLayer = L.geoJSON(geo, {
                    style: myStyle
                }).addTo(this.map)

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                var options = { tolerance: 0.00001, highQuality: true };
                var simplifiedLine = turf.simplify(geo, options);
                var simplifiedLineLayer = L.geoJSON(simplifiedLine, {
                    style: {
                        "color": "green",
                        "weight": 5,
                        "opacity": 0.65
                    }
                }).addTo(this.map)

                this.simplifiedLine = simplifiedLine
                //SEND THIS "simplifiedLine" to server 


            };
            // Clear up the events when the user releases the mouse.
            this.map.on('mouseup touchend', mouseUp);
            'body' in document && document.body.addEventListener('mouseleave', mouseUp);
        };
        this.map.on('mousedown touchstart', mouseDown);
    }

    saveData(data) {
        const query = {
            action: 'save',
            data: data
        }
        return fetch('https://serg.one/save-load-data/index.php', {
            method: "POST",
            body: JSON.stringify(query)
        })
            .then(response => response.json())
            .then(json => {
                alert(json.result)
                console.log(json.result)
            })
            .catch(e => {
                alert(e)
            })
    }

    loadData() {
        const query = {
            action: 'load',
        }
        return fetch('https://serg.one/save-load-data/index.php', {
            method: "POST",
            body: JSON.stringify(query)
        })
            .then(response => response.json())
            .then(json => {
                console.log(json)

                this.simplifiedLine = json;
                const loadedLayer = L.geoJSON(json, {
                    style: {
                        "color": "green",
                        "weight": 5,
                        "opacity": 0.65
                    }
                }).addTo(this.map)
                console.log('loadedLayer', loadedLayer);
                this.drawnItems.addLayer(loadedLayer.getLayers()[0]);
            })
            .catch(e => {
                alert(e)
            })
    }

    fetchData() {
        const SW = this.map.getBounds().getSouthWest()
        const NE = this.map.getBounds().getNorthEast()
        const bounds = `${SW.lat},${SW.lng},${NE.lat},${NE.lng}`
        const query = `[out:json][timeout:25];(way["highway"](${bounds}););out body;>;out skel qt;`
        return fetch('https://overpass-api.de/api/interpreter', {
            method: "POST",
            body: query
        })
            .then(response => response.json())
            .then(json => osmtogeojson(json))
            .catch(e => {
                alert(e)
            })
    }

}