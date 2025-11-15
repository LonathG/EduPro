import React, { useState } from 'react';
import axios from 'axios';

// IMPORTANT: Ensure your Flask server is running on this port (5001)
const API_URL = 'http://127.0.0.1:5001'; 

// --- STYLES DEFINITION (Optimized for full screen height and scroll logic) ---
const styles = {
    // General Layout
    processorContainer: {
        padding: '30px',
        // Make container take full viewport height
        height: '100vh', 
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        background: '#f8f9fa', 
    },
    gridContainer: {
        display: 'grid',
        gridTemplateColumns: '1.2fr 1.5fr 1.5fr', 
        gap: '30px',
        // Take up all remaining vertical space in processorContainer
        flexGrow: 1, 
        minHeight: '0', 
        marginTop: '20px',
    },
    // Panels
    panel: {
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', 
        overflowY: 'hidden', // Default: HIDDEN SCROLL for image panels
        overflowX: 'hidden', 
        display: 'flex', 
        flexDirection: 'column', // Enable vertical stacking and dynamic sizing
    },
    controlsPanel: {
        // Override: ENABLE SCROLL for controls
        overflowY: 'auto', 
        overflowX: 'hidden',
    },
    // Headings (Simplified inline styles for brevity)
    h2: { color: '#007bff', marginBottom: '10px', borderBottom: '2px solid #e9ecef', paddingBottom: '10px', flexShrink: 0},
    h3: { color: '#343a40', marginTop: '15px', marginBottom: '10px', flexShrink: 0},
    hr: { border: '0', height: '1px', background: '#ced4da', margin: '20px 0', flexShrink: 0},
    
    // Inputs & Buttons (Simplified inline styles for brevity)
    inputField: { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ced4da', boxSizing: 'border-box', transition: 'border-color 0.3s',},
    select: { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ced4da', boxSizing: 'border-box', backgroundColor: '#fff', appearance: 'none', },
    buttonBase: { padding: '10px 15px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s ease', marginTop: '5px', marginBottom: '5px',},
    buttonPrimary: { background: '#007bff', color: 'white', boxShadow: '0 2px 4px rgba(0, 123, 255, 0.4)', },
    buttonSecondary: { background: '#6c757d', color: 'white', },
    buttonUtility: { background: '#f0f0f0', color: '#343a40', border: '1px solid #ced4da', },
    buttonDisabled: { opacity: 0.6, cursor: 'not-allowed', boxShadow: 'none', },
    
    // Image View
    imageDisplayContainer: {
        flexGrow: 1, // Crucial: Takes up all available vertical space
        minHeight: '200px', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '10px',
        overflow: 'hidden', 
    },
    imageView: {
        maxWidth: '100%',
        maxHeight: '100%', // Scales image to fit container perfectly
        width: 'auto',
        height: 'auto',
        borderRadius: '8px',
        objectFit: 'contain',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
        transition: 'transform 0.3s',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        border: '2px dashed #adb5bd',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6c757d',
        background: '#e9ecef',
    },
    // Metadata
    metadataList: {
        listStyle: 'none',
        padding: 0,
        margin: '10px 0',
        lineHeight: '1.8',
        flexShrink: 0, // Prevent shrinking
    }
};

// --- HOVER ANIMATION LOGIC (Used for buttons) ---
const useHover = (initialStyle, hoverStyle) => {
    const [style, setStyle] = useState(initialStyle);
    const onMouseEnter = () => setStyle({ ...initialStyle, ...hoverStyle });
    const onMouseLeave = () => setStyle(initialStyle);
    return { style, onMouseEnter, onMouseLeave };
};

const primaryButtonHover = {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 12px rgba(0, 123, 255, 0.6)',
    background: '#0056b3'
};

function ImageProcessor() {
    // --- State Definitions (Unchanged) ---
    const [originalImageURL, setOriginalImageURL] = useState(null);
    const [processedImageURL, setProcessedImageURL] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [message, setMessage] = useState('Awaiting image load...');
    const [rotationAngle, setRotationAngle] = useState(0);
    const [selectedConversion, setSelectedConversion] = useState('grayscale'); 
    const [selectedFilter, setSelectedFilter] = useState('median'); 
    const [filterKernel, setFilterKernel] = useState(5); 
    const [selectedEdgeFilter, setSelectedEdgeFilter] = useState('canny');
    const [selectedMorphOp, setSelectedMorphOp] = useState('erode');
    const [morphKernel, setMorphKernel] = useState(5);
    const [selectedSegmenter, setSelectedSegmenter] = useState('otsu');
    const [selectedFreqFilter, setSelectedFreqFilter] = useState('lowpass_gaussian');
    const [freqCutoff, setFreqCutoff] = useState(30);
    const [scaleX, setScaleX] = useState(1.0);
    const [scaleY, setScaleY] = useState(1.0);
    const [transX, setTransX] = useState(0);
    const [transY, setTransY] = useState(0);
    const [cropX, setCropX] = useState(0); 
    const [cropY, setCropY] = useState(0);
    const [cropW, setCropW] = useState(100);
    const [cropH, setCropH] = useState(100);
    const [selectedHistType, setSelectedHistType] = useState('grayscale');

    // --- Reset Helpers (Unchanged) ---
    const resetRotation = () => setRotationAngle(0);
    const resetScale = () => { setScaleX(1.0); setScaleY(1.0); };
    const resetTranslate = () => { setTransX(0); setTransY(0); };
    const resetCrop = () => { setCropX(0); setCropY(0); setCropW(100); setCropH(100); };
    
    // --- Hover Hooks ---
    const loadButtonProps = useHover({ ...styles.buttonBase, ...styles.buttonPrimary }, primaryButtonHover);

    // --- Helper function (FIXED - No change) ---
    const decodeAndSetImage = (hexData, currentMessage) => {
        try {
            const bytes = new Uint8Array(hexData.length / 2);
            for (let i = 0; i < hexData.length; i += 2) {
                bytes[i / 2] = parseInt(hexData.substring(i, i + 2), 16);
            }
            const blob = new Blob([bytes], {type: 'image/png'});
            setProcessedImageURL(URL.createObjectURL(blob));
            setMessage(currentMessage);
        } catch (e) {
            setMessage("Error decoding image data.");
            console.error("Decoding error:", e);
        }
    };

    // --- Backend API Logic (Unchanged for this fix) ---
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadedFile(file);
            setOriginalImageURL(URL.createObjectURL(file));
            setProcessedImageURL(null);
            setMetadata(null);
            setMessage(`File selected: ${file.name}`);
        }
    };

    const applyGrayscaleAndGetMeta = async () => {
        if (!uploadedFile) return;
        const formData = new FormData();
        formData.append('file', uploadedFile);
        try {
            const response = await axios.post(`${API_URL}/process_and_meta`, formData);
            const { metadata, processed_image_hex, message } = response.data;
            metadata.file_size = `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB`;
            setMetadata(metadata);
            decodeAndSetImage(processed_image_hex, message);
        } catch (error) {
            console.error("Error processing image:", error);
            setMessage("Error processing image.");
        }
    };

    const applyConversion = async (conversionType) => {
        if (!uploadedFile) return;
        setMessage(`Applying ${conversionType.toUpperCase()} conversion...`);
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('conversion_type', conversionType);
        try {
            const response = await axios.post(`${API_URL}/convert_color`, formData); 
            decodeAndSetImage(response.data.processed_image_hex, response.data.message);
        } catch (error) {
            console.error("Error applying conversion:", error);
            setMessage("Error applying conversion.");
        }
    };

    const applyTransformation = async (opType) => {
        if (!uploadedFile) return;
        setMessage(`Applying ${opType}...`);
        
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('op_type', opType); 
        
        switch (opType) {
            case 'rotate': formData.append('angle', rotationAngle); break;
            case 'scale': formData.append('scale_x', scaleX); formData.append('scale_y', scaleY); break;
            case 'translate': formData.append('tx', transX); formData.append('ty', transY); break;
            case 'crop': formData.append('x', cropX); formData.append('y', cropY); formData.append('w', cropW); formData.append('h', cropH); break;
            default: return;
        }

        try {
            const response = await axios.post(`${API_URL}/transform/geometry`, formData);
            decodeAndSetImage(response.data.processed_image_hex, response.data.message);
        } catch (error) {
            console.error(`Error applying ${opType}:`, error);
            setMessage(`Error applying ${opType}.`);
        }
    };

    const applySmoothing = async () => {
        if (!uploadedFile) return;
        setMessage(`Applying ${selectedFilter} filter...`);
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('filter', selectedFilter);
        formData.append('kernel', filterKernel);
        try {
            const response = await axios.post(`${API_URL}/filter/smooth`, formData);
            decodeAndSetImage(response.data.processed_image_hex, response.data.message);
        } catch (error) {
            console.error("Error applying smoothing:", error);
            setMessage("Error applying smoothing.");
        }
    };

    const applyEdgeSharpen = async () => {
        if (!uploadedFile) return;
        setMessage(`Applying ${selectedEdgeFilter} filter...`);
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('filter_type', selectedEdgeFilter);
        try {
            const response = await axios.post(`${API_URL}/filter/edge_sharpen`, formData);
            decodeAndSetImage(response.data.processed_image_hex, response.data.message);
        } catch (error) {
            console.error("Error applying edge/sharpen filter:", error);
            setMessage("Error applying filter.");
        }
    };

    const applyMorphology = async () => {
        if (!uploadedFile) return;
        setMessage(`Applying ${selectedMorphOp} with kernel ${morphKernel}...`);
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('op_type', selectedMorphOp);
        formData.append('kernel', morphKernel);
        try {
            const response = await axios.post(`${API_URL}/filter/morphology`, formData);
            decodeAndSetImage(response.data.processed_image_hex, response.data.message);
        } catch (error) {
            console.error("Error applying morphology:", error);
            setMessage("Error applying operation.");
        }
    };

    const applySegmentation = async () => {
        if (!uploadedFile) return;
        setMessage(`Applying ${selectedSegmenter} segmentation...`);
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('seg_type', selectedSegmenter);
        try {
            const response = await axios.post(`${API_URL}/segmentation`, formData);
            decodeAndSetImage(response.data.processed_image_hex, response.data.message);
        } catch (error) {
            console.error("Error applying segmentation:", error);
            setMessage("Error applying segmentation.");
        }
    };

    const applyFrequencyFilter = async () => {
        if (!uploadedFile) return;
        setMessage(`Applying ${selectedFreqFilter} (Cutoff: ${freqCutoff})...`);
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('filter_type', selectedFreqFilter);
        formData.append('cutoff', freqCutoff);
        try {
            const response = await axios.post(`${API_URL}/filter/frequency`, formData);
            decodeAndSetImage(response.data.processed_image_hex, response.data.message);
        } catch (error) {
            console.error("Error applying frequency filter:", error);
            setMessage("Error applying filter.");
        }
    };

    const handleHistogram = async (op_type) => {
        if (!uploadedFile) return;
        
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('op_type', op_type); 
        formData.append('hist_type', selectedHistType); 

        let currentMessage = op_type === 'generate' ? `Generating ${selectedHistType} histogram...` : 'Applying Histogram Equalization...';
        setMessage(currentMessage);
        
        try {
            const response = await axios.post(`${API_URL}/histogram`, formData);
            decodeAndSetImage(response.data.processed_image_hex, response.data.message);
        } catch (error) {
            console.error("Error with histogram operation:", error);
            setMessage("Error in histogram operation.");
        }
    };


    return (
        <div className="processor-container" style={styles.processorContainer}>
            
            <h2 style={styles.h2}>EduPro</h2>
            {/* <h3 style={styles.h2}>Your Educational Image Processor</h3> */}
            
            <div style={styles.gridContainer}>
                
                {/* --- COLUMN 1: CONTROLS (Scrollable Y, Hidden X) --- */}
                <div className="controls-panel" style={{ ...styles.panel, ...styles.controlsPanel }}>
                    
                    {/* --- 1. Image Input (A.1) --- */}
                    <h3 style={styles.h3}>Image Input</h3>
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{...styles.inputField, padding: '5px'}}/>
                    <button 
                        onClick={applyGrayscaleAndGetMeta} 
                        disabled={!uploadedFile}
                        style={{ 
                            ...styles.buttonBase, 
                            ...(uploadedFile ? loadButtonProps.style : styles.buttonDisabled),
                            width: '100%', 
                            background: '#28a745'
                        }}
                        onMouseEnter={uploadedFile ? loadButtonProps.onMouseEnter : undefined}
                        onMouseLeave={uploadedFile ? loadButtonProps.onMouseLeave : undefined}
                    >
                        Load Image & Get Metadata
                    </button>
                    <hr style={styles.hr}/>

                    {/* --- 2. Color Space Conversions (A.2) --- */}
                    <h3 style={styles.h3}>Color Conversions</h3>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Convert To:</label>
                    <select 
                        value={selectedConversion} 
                        onChange={(e) => setSelectedConversion(e.target.value)}
                        style={styles.select}
                    >
                        <option value="grayscale">BGR ↔ Grayscale</option>
                        <option value="hsv">BGR ↔ HSV</option>
                        <option value="binary">BGR ↔ Binary</option>
                    </select>
                    <button 
                        onClick={() => applyConversion(selectedConversion)} 
                        disabled={!uploadedFile} 
                        style={{...styles.buttonBase, ...styles.buttonSecondary, width: '100%'}}
                    >
                        Apply Conversion
                    </button>
                    <hr style={styles.hr}/>

                    {/* --- 3. Geometric Transformations (A.4) --- */}
                    <h3 style={styles.h3}>Geometric Transformations</h3>
                    
                    {/* Rotation */}
                    <label style={{ display: 'block' }}>Rotation Angle: {rotationAngle}°</label>
                    <input
                        type="range" min="-180" max="180" step="5"
                        value={rotationAngle}
                        onChange={(e) => setRotationAngle(e.target.value)}
                        style={styles.inputField}
                    />
                    <button onClick={() => applyTransformation('rotate')} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '48%', marginRight: '4%'}}>Rotate</button>
                    <button onClick={resetRotation} style={{...styles.buttonBase, ...styles.buttonUtility, width: '48%'}}>Reset</button>

                    {/* Scaling */}
                    <label style={{ display: 'block', marginTop: '10px' }}>Scale X: {scaleX}</label>
                    <input type="range" min="0.1" max="2.0" step="0.1" value={scaleX} onChange={(e) => setScaleX(e.target.value)} style={styles.inputField} />
                    <label style={{ display: 'block' }}>Scale Y: {scaleY}</label>
                    <input type="range" min="0.1" max="2.0" step="0.1" value={scaleY} onChange={(e) => setScaleY(e.target.value)} style={styles.inputField} />
                    <button onClick={() => applyTransformation('scale')} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '48%', marginRight: '4%'}}>Scale</button>
                    <button onClick={resetScale} style={{...styles.buttonBase, ...styles.buttonUtility, width: '48%'}}>Reset</button>

                    {/* Translation */}
                    <label style={{ display: 'block', marginTop: '10px' }}>Translate X: {transX} px</label>
                    <input type="range" min="-100" max="100" step="5" value={transX} onChange={(e) => setTransX(e.target.value)} style={styles.inputField} />
                    <label style={{ display: 'block' }}>Translate Y: {transY} px</label>
                    <input type="range" min="-100" max="100" step="5" value={transY} onChange={(e) => setTransY(e.target.value)} style={styles.inputField} />
                    <button onClick={() => applyTransformation('translate')} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '48%', marginRight: '4%'}}>Translate</button>
                    <button onClick={resetTranslate} style={{...styles.buttonBase, ...styles.buttonUtility, width: '48%'}}>Reset</button>
                    
                    {/* Cropping */}
                    <label style={{ display: 'block', marginTop: '10px' }}>Crop X Pos (0-100%): {cropX}</label>
                    <input type="range" min="0" max="100" step="5" value={cropX} onChange={(e) => setCropX(e.target.value)} style={styles.inputField} />
                    <label style={{ display: 'block' }}>Crop W (0-100%): {cropW}</label>
                    <input type="range" min="5" max="100" step="5" value={cropW} onChange={(e) => setCropW(e.target.value)} style={styles.inputField} />
                    <button onClick={() => applyTransformation('crop')} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '48%', marginRight: '4%'}}>Crop</button>
                    <button onClick={resetCrop} style={{...styles.buttonBase, ...styles.buttonUtility, width: '48%'}}>Reset</button>
                    <hr style={styles.hr}/>

                    {/* --- 4. Smoothing (B.1) --- */}
                    <h3 style={styles.h3}>Image Smoothing</h3>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Filter:</label>
                    <select 
                        value={selectedFilter} 
                        onChange={(e) => setSelectedFilter(e.target.value)}
                        style={styles.select}
                    >
                        <option value="median">Median Filter</option>
                        <option value="gaussian">Gaussian Filter</option>
                        <option value="averaging">Averaging Filter</option>
                    </select>
                    <label style={{ display: 'block', marginTop: '10px' }}>Kernel Size (Odd only): {filterKernel}</label>
                    <input
                        type="range" min="3" max="15" step="2"
                        value={filterKernel}
                        onChange={(e) => setFilterKernel(e.target.value)}
                        style={styles.inputField}
                    />
                    <button onClick={applySmoothing} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '100%'}}>Apply Filter</button>
                    <hr style={styles.hr}/>

                    {/* --- 5. Edge & Sharpening (B.2) --- */}
                    <h3 style={styles.h3}>Edge & Sharpening</h3>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Filter:</label>
                    <select 
                        value={selectedEdgeFilter} 
                        onChange={(e) => setSelectedEdgeFilter(e.target.value)}
                        style={styles.select}
                    >
                        <option value="canny">Canny Edges</option>
                        <option value="sobel_x">Sobel X</option>
                        <option value="sobel_y">Sobel Y</option>
                        <option value="laplacian">Laplacian</option>
                        <option value="sharpen">Sharpen</option>
                    </select>
                    <button onClick={applyEdgeSharpen} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '100%'}}>
                        Apply Edge/Sharpen Filter
                    </button>
                    <hr style={styles.hr}/>

                    {/* --- 6. Morphological Operations (B.3) --- */}
                    <h3 style={styles.h3}>Morphological Ops</h3>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Operation:</label>
                    <select 
                        value={selectedMorphOp} 
                        onChange={(e) => setSelectedMorphOp(e.target.value)}
                        style={styles.select}
                    >
                        <option value="erode">Erosion</option>
                        <option value="dilate">Dilation</option>
                        <option value="opening">Opening</option>
                        <option value="closing">Closing</option>
                    </select>
                    <label style={{ display: 'block', marginTop: '10px' }}>Kernel Size (Odd only): {morphKernel}</label>
                    <input
                        type="range" min="3" max="15" step="2"
                        value={morphKernel}
                        onChange={(e) => setMorphKernel(e.target.value)}
                        style={styles.inputField}
                    />
                    <button onClick={applyMorphology} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '100%'}}>
                        Apply Morphological Op
                    </button>
                    <hr style={styles.hr}/>

                    {/* --- 7. Segmentation (B.4) --- */}
                    <h3 style={styles.h3}>Segmentation</h3>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Technique:</label>
                    <select 
                        value={selectedSegmenter} 
                        onChange={(e) => setSelectedSegmenter(e.target.value)}
                        style={styles.select}
                    >
                        <option value="global_thresh">Global Threshold (127)</option>
                        <option value="otsu">Otsu's Thresholding</option>
                        <option value="watershed">Watershed</option>
                    </select>
                    <button onClick={applySegmentation} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '100%'}}>
                        Apply Segmentation
                    </button>
                    <hr style={styles.hr}/>

                    {/* --- 8. Frequency Domain (B.5) --- */}
                    <h3 style={styles.h3}>Frequency Domain</h3>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Filter:</label>
                    <select 
                        value={selectedFreqFilter} 
                        onChange={(e) => setSelectedFreqFilter(e.target.value)}
                        style={styles.select}
                    >
                        <option value="lowpass_gaussian">Gaussian Low Pass</option>
                        <option value="highpass_gaussian">Gaussian High Pass</option>
                        <option value="lowpass_ideal">Ideal Low Pass</option>
                        <option value="highpass_ideal">Ideal High Pass</option>
                    </select>
                    <label style={{ display: 'block', marginTop: '10px' }}>Cutoff Frequency: {freqCutoff}</label>
                    <input
                        type="range" min="1" max="100" step="1"
                        value={freqCutoff}
                        onChange={(e) => setFreqCutoff(e.target.value)}
                        style={styles.inputField}
                    />
                    <button onClick={applyFrequencyFilter} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '100%'}}>
                        Apply Frequency Filter
                    </button>
                    <hr style={styles.hr}/>

                    {/* --- 9. Histogram Analysis (A.3) --- */}
                    <h3 style={styles.h3}>Histogram Analysis</h3>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Operation Target:</label>
                    <select 
                        value={selectedHistType} 
                        onChange={(e) => setSelectedHistType(e.target.value)}
                        style={styles.select}
                    >
                        <option value="grayscale">Grayscale</option>
                        <option value="color">Color (RGB)</option>
                    </select>
                    <button onClick={() => handleHistogram('generate')} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '100%'}}>
                        Generate Histogram Plot*
                    </button>
                    <button onClick={() => handleHistogram('equalize')} disabled={!uploadedFile} style={{...styles.buttonBase, ...styles.buttonSecondary, width: '100%'}}>
                        Apply Histogram Equalization
                    </button>
                    <p style={{ fontSize: '0.8em', marginTop: '5px', color: '#6c757d', flexShrink: 0 }}>*Plot data is returned as an image.</p>

                </div>
                
                {/* --- COLUMN 2: ORIGINAL IMAGE (Non-Scrollable, Height-Flexible) --- */}
                <div className="original-view" style={styles.panel}>
                    <h3 style={styles.h3}>Original Image</h3>
                    
                    {/* The image container fills the space between the H3 and the Metadata */}
                    <div style={styles.imageDisplayContainer}>
                        {originalImageURL ? (
                            <img 
                                src={originalImageURL} 
                                alt="Original" 
                                style={styles.imageView} 
                            />
                        ) : (
                            <div style={styles.imagePlaceholder}>
                                Upload an image to start.
                            </div>
                        )}
                    </div>

                    {/* Metadata Section: fixed height, forces image container to take remaining space */}
                    {metadata && (
                        <>
                            <h4 style={{ color: '#28a745', borderBottom: '1px solid #e9ecef', paddingBottom: '5px', marginTop: '20px', flexShrink: 0 }}>✅ Image Metadata (A.1)</h4>
                            <ul style={styles.metadataList}>
                                <li>File Name: {metadata.file_name}</li>
                                <li>File Size: {metadata.file_size}</li>
                                <li>Dimensions: {metadata.dimensions}</li>
                                <li>Channels: {metadata.channels}</li>
                                <li>Color Depth: {metadata.color_depth}</li>
                                <li>Color Space (Raw): {metadata.color_space}</li>
                            </ul>
                        </>
                    )}
                </div>
                
                {/* --- COLUMN 3: PROCESSED IMAGE (Non-Scrollable, Height-Flexible) --- */}
                <div className="processed-view" style={styles.panel}>
                    <h3 style={styles.h3}>Processed Output</h3>
                    <p style={{ color: processedImageURL ? '#007bff' : '#6c757d', fontWeight: '600', flexShrink: 0 }}>{message}</p>
                    
                    <div style={styles.imageDisplayContainer}>
                        {processedImageURL ? (
                            <img 
                                src={processedImageURL} 
                                alt="Processed" 
                                style={{...styles.imageView, border: '2px solid #007bff'}} 
                            />
                        ) : (
                            <div style={{...styles.imagePlaceholder, border: '2px dashed #007bff'}}>
                                Processed image will appear here.
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default ImageProcessor;