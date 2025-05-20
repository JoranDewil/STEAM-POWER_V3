//#region IMPORTS
//#endregion IMPORTS
import SunCalc from './solar.js'; 
//#region SIMULATION
let template = document.createElement('template');
template.innerHTML = /*html*/`
    <style>
        @import './Components/simulation/style.css';
    </style>
    <div class="simulation-container">
        <canvas id="renderCanvas"></canvas>
    </div>
`;
//#endregion SIMULATION

//#region CLASS 
window.customElements.define('simulation-れ', class extends HTMLElement {
    constructor() {
        super();
        this._shadowRoot = this.attachShadow({ 'mode': 'open' });
        this._shadowRoot.appendChild(template.content.cloneNode(true));
        
        // BabylonJS properties
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.resizeObserver = null;
    }

    // component attributes
    static get observedAttributes() {
        return [];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        
    }

    connectedCallback() {
        // Initialize the BabylonJS scene
        this._initializeBabylonJS();
        
        // Start the render loop
        this._startRenderLoop();
        
        // Prevent wheel events from propagating to prevent page scrolling
        const canvas = this._shadowRoot.getElementById('renderCanvas');
        canvas.addEventListener('wheel', this._preventScroll);
        
        // Also prevent touch events from scrolling
        canvas.addEventListener('touchmove', this._preventScroll);
        
        // Set up resize observer for high resolution rendering
        this._setupResizeObserver();
    }
    
    disconnectedCallback() {
        // Clean up resources when component is removed
        const canvas = this._shadowRoot.getElementById('renderCanvas');
        if (canvas) {
            canvas.removeEventListener('wheel', this._preventScroll);
            canvas.removeEventListener('touchmove', this._preventScroll);
        }
        
        if (this.engine) {
            this.engine.dispose();
        }
        
        // Remove resize listener
        window.removeEventListener('resize', this._handleResize);
        
        // Disconnect the resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
    
    _preventScroll(event) {
        event.preventDefault();
    }
    
    _handleResize = () => {
        if (this.engine) {
            this._updateCanvasSize();
            this.engine.resize();
        }
    }
    
    _setupResizeObserver() {
        const container = this._shadowRoot.querySelector('.simulation-container');
        const canvas = this._shadowRoot.getElementById('renderCanvas');
        
        // Use ResizeObserver to detect size changes with higher precision
        this.resizeObserver = new ResizeObserver(() => {
            this._updateCanvasSize();
            if (this.engine) {
                this.engine.resize();
            }
        });
        
        this.resizeObserver.observe(container);
        
        // Initial size adjustment
        this._updateCanvasSize();
    }
    
    _updateCanvasSize() {
        const container = this._shadowRoot.querySelector('.simulation-container');
        const canvas = this._shadowRoot.getElementById('renderCanvas');
        
        if (container && canvas) {
            // Get the actual displayed size
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            // Only update if needed to avoid unnecessary reflows
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
        }
    }
    
    _initializeBabylonJS() {
        // Get the canvas element from shadow DOM
        const canvas = this._shadowRoot.getElementById('renderCanvas');
        
        // Check if BabylonJS is available
        if (typeof BABYLON === 'undefined') {
            console.error('BabylonJS is not loaded. Make sure to include the BabylonJS script.');
            return;
        }
        
        // Initialize the BabylonJS engine with high DPI support
        this.engine = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
            adaptToDeviceRatio: true // Enable high DPI rendering
        });
        
        // Create scene
        this.scene = new BABYLON.Scene(this.engine);

        // Camera
        this.camera = new BABYLON.ArcRotateCamera("Camera", 
            Math.PI / 2, Math.PI / 3.5, 8,
            new BABYLON.Vector3(0, 0, 0), this.scene);
        this.camera.attachControl(canvas, true, false, 0); // noPreventDefault = false to prevent scrolling
        
        // Light
        const light = new BABYLON.HemisphericLight("light", 
            new BABYLON.Vector3(1, 1, 0), this.scene);

        // Load Nature.glb
        BABYLON.SceneLoader.Append("", "../Frontend/Assets/GLBs/Nature.glb", this.scene, () => {
            console.log("Nature.glb loaded");
        });

        // Hot air balloon
        BABYLON.SceneLoader.Append("", "../Frontend/Assets/GLBs/Hot air balloon.glb", this.scene, () => {
            console.log("Hot air balloon.glb loaded");

            // Get all meshes from the scene
            this.scene.meshes.forEach(mesh => {
                console.log("Loaded mesh:", mesh.name);

                // If the hot air balloon has a root mesh or a recognizable part, transform it
                if (mesh.name === "__root__" || mesh.name.toLowerCase().includes("balloon")) {
                    // Resize the balloon
                    mesh.scaling = new BABYLON.Vector3(0.002, 0.002, 0.002); 

                    // Move the balloon to a good location
                    mesh.position = new BABYLON.Vector3(-1, 1, -1.5); 

                    // Rotate the balloon
                    mesh.rotation = new BABYLON.Vector3(-1.6, 0, 0); 

                    console.log(`Applied transform to ${mesh.name}`);
                }
            });
        });

        // Sun
        BABYLON.SceneLoader.ImportMesh("", "", "../Frontend/Assets/GLBs/Sun with beams.glb", this.scene, async (meshes) => {
            console.log("Sun.glb loaded");

            const street = "Geldenaaksebaan 335";
            const city = "Leuven";
            const postal = "3001";
            const date = new Date(); 
            // date.setHours(0, 0, 0, 0)
            const { azimuth, altitude } = await SunCalc.getSolarPositionForLocation(street, city, postal, date);
            const x = Math.cos(altitude) * Math.sin(azimuth);
            const y = Math.sin(altitude);
            const z = Math.cos(altitude) * Math.cos(azimuth);
            

            // Find the root mesh
            const sunRoot = meshes.find(m => m.name === "__root__");

            if (sunRoot) {
                const distance = 10;
                sunRoot.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
                sunRoot.position = new BABYLON.Vector3(x * distance, y * distance, z * distance);
                sunRoot.rotation = new BABYLON.Vector3(0, 0.8, 0);
                console.log("Applied transform to Sun root");
            }
        });

        // Clouds (multiple instances)
        this._loadClouds(1.5, 1.7, -3, 0);
        this._loadClouds(-2.5, 1.8, -3, 0);
        this._loadClouds(2.5, 1, -3, 0);
        this._loadClouds(-1.5, 1.2, -3, 0);
        
        // Windmill
        BABYLON.SceneLoader.ImportMesh("", "", "../Frontend/Assets/GLBs/windmill.glb", this.scene, (meshes) => {
            console.log("Tower Windmill.glb loaded");

            const windmillRoot = meshes.find(m => m.name === "__root__");
            if (windmillRoot) {
                windmillRoot.scaling = new BABYLON.Vector3(3.5, 3.5, 3.5);
                windmillRoot.position = new BABYLON.Vector3(-1.5, 0, 0);
                windmillRoot.rotation = new BABYLON.Vector3(0, 0.5, 0);
            }
        });

        // House
        BABYLON.SceneLoader.ImportMesh("", "", "../Frontend/Assets/GLBs/House.glb", this.scene, (meshes) => {
            console.log("House.glb loaded");

            const houseRoot = meshes.find(m => m.name === "__root__");
            if (houseRoot) {
                houseRoot.scaling = new BABYLON.Vector3(0.3, 0.3, 0.3);
                houseRoot.position = new BABYLON.Vector3(1, 0, -0.9);
                houseRoot.rotation = new BABYLON.Vector3(0, 0, 0);
            }
        });

        // Sail Boat
        BABYLON.SceneLoader.ImportMesh("", "", "../Frontend/Assets/GLBs/Sail Boat.glb", this.scene, (meshes) => {
            console.log("Sail Boat.glb loaded");

            const boatRoot = meshes.find(m => m.name === "__root__" || m.name.toLowerCase().includes("boat"));
            if (boatRoot) {
                boatRoot.scaling = new BABYLON.Vector3(0.8, 0.8, 0.8);
                boatRoot.position = new BABYLON.Vector3(-0.7, -0.1, -0.6);
                boatRoot.rotation = new BABYLON.Vector3(0, 0.8, 0);
            }
        });

        // Logs
        BABYLON.SceneLoader.ImportMesh("", "", "../Frontend/Assets/GLBs/logs.glb", this.scene, (meshes) => {
            console.log("logs.glb loaded");

            const logsRoot = meshes.find(m => m.name === "__root__" || m.name.toLowerCase().includes("log"));
            if (logsRoot) {
                logsRoot.scaling = new BABYLON.Vector3(1, 1, 1);
                logsRoot.position = new BABYLON.Vector3(1.48, 0, -0.3);
                logsRoot.rotation = new BABYLON.Vector3(0, 0, 0);
            }
        });

        // Well
        BABYLON.SceneLoader.ImportMesh("", "", "../Frontend/Assets/GLBs/Well.glb", this.scene, (meshes) => {
            console.log("Well.glb loaded");

            const wellRoot = meshes.find(m => m.name === "__root__" || m.name.toLowerCase().includes("well"));
            if (wellRoot) {
                wellRoot.scaling = new BABYLON.Vector3(0.4, 0.4, 0.4);
                wellRoot.position = new BABYLON.Vector3(0.3, 0, -0.5);
                wellRoot.rotation = new BABYLON.Vector3(0, 1, 0);
            }
        });

        // Watermill
        BABYLON.SceneLoader.ImportMesh("", "", "../Frontend/Assets/GLBs/watermill.glb", this.scene, (meshes) => {
            console.log("watermill.glb loaded");

            const watermillRoot = meshes.find(m => m.name === "__root__" || m.name.toLowerCase().includes("watermill"));
            if (watermillRoot) {
                watermillRoot.scaling = new BABYLON.Vector3(0.03, 0.03, 0.03);
                watermillRoot.position = new BABYLON.Vector3(1, -0.08, 0.9);
                watermillRoot.rotation = new BABYLON.Vector3(0, -0.5, 0);
            }
        });

        // Handle window resize
        window.addEventListener('resize', this._handleResize);
    }
    
    _loadClouds(x, y, z, rotation) {
        BABYLON.SceneLoader.ImportMesh("", "", "../Frontend/Assets/GLBs/Clouds.glb", this.scene, (meshes) => {
            console.log("Clouds.glb loaded");

            const cloudsRoot = meshes.find(m => m.name === "__root__");
            if (cloudsRoot) {
                cloudsRoot.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
                cloudsRoot.position = new BABYLON.Vector3(x, y, z);
                cloudsRoot.rotation = new BABYLON.Vector3(0, rotation, 0);
            }
        });
    }
    
    _startRenderLoop() {
        if (this.engine && this.scene) {
            this.engine.runRenderLoop(() => {
                this.scene.render();
            });
        }
    }
});
//#endregion CLASS
