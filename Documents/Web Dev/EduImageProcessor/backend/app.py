from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import io

# 1. Import the base matplotlib library
import matplotlib
# 2. Set the backend to 'Agg' (a non-GUI backend)
#    This MUST be done BEFORE importing pyplot
matplotlib.use('Agg')
# 3. Now, import pyplot
import matplotlib.pyplot as plt

app = Flask(__name__)
# IMPORTANT: Adjusted CORS origin to ensure communication with React on port 3000. 
# If your React app is running on 3001, please change this back.
CORS(app, resources={r"/*": {"origins": "http://localhost:3001"}})

# --- Helper Function for Image Encoding ---
def encode_image_to_hex(img):
    """Encodes an OpenCV image to a PNG buffer and returns a hex string."""
    if img is None or img.size == 0:
        raise Exception("Processed image is empty or invalid.")
    
    # Convert grayscale images (2D array) to BGR (3D array) before encoding 
    # to maintain consistency for the frontend if the operation outputs grayscale.
    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    is_success, buffer = cv2.imencode(".png", img)
    if not is_success:
        raise Exception("Could not encode image to buffer.")
    return buffer.tobytes().hex()

# --- Helper Function for Image Reading ---
def read_image_from_request(color_mode=cv2.IMREAD_COLOR):
    """Reads an image from the request, decodes it, and returns the cv2 image."""
    if 'file' not in request.files:
        return None, "No file part"
    
    file = request.files['file']
    np_img = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(np_img, color_mode)
    
    return img, file.filename

# --- Helper Function for Metadata (A.1) ---
def get_image_metadata(img):
    if len(img.shape) == 3:
        height, width, channels = img.shape
        color_space = "BGR (Color)"
    elif len(img.shape) == 2:
        height, width = img.shape
        channels = 1
        color_space = "Grayscale"
    else:
        height, width, channels, color_space = 0, 0, 0, "Unknown"
    color_depth = f"{img.dtype.itemsize * 8} bits per channel"
    return {
        'dimensions': f"{width} x {height}",
        'channels': channels,
        'color_space': color_space,
        'color_depth': color_depth,
    }

# --- Core API Endpoint (A.1 & Default A.2 Grayscale) ---
@app.route('/process_and_meta', methods=['POST'])
def process_and_meta():
    img, filename = read_image_from_request()
    if img is None: return jsonify({'error': 'No file part'}), 400
    metadata = get_image_metadata(img)
    metadata['file_name'] = filename
    gray_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    try:
        processed_image_hex = encode_image_to_hex(gray_img)
        return jsonify({
            'metadata': metadata,
            'processed_image_hex': processed_image_hex,
            'message': 'Image loaded. Default output: Grayscale (A.2).'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- A.2: Color Space Conversions ---
@app.route('/convert_color', methods=['POST'])
def convert_color():
    img, _ = read_image_from_request()
    if img is None: return jsonify({'error': 'No file part'}), 400
    conversion_type = request.form.get('conversion_type', 'grayscale')
    
    if conversion_type == 'grayscale':
        converted_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        message = 'Converted to Grayscale.'
    elif conversion_type == 'hsv':
        converted_img = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        message = 'Converted to HSV.'
    elif conversion_type == 'binary':
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, converted_img = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
        message = 'Converted to Binary (Threshold 127).'
    else:
        return jsonify({'error': 'Invalid conversion type'}), 400
    try:
        processed_image_hex = encode_image_to_hex(converted_img)
        return jsonify({'processed_image_hex': processed_image_hex, 'message': message})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- A.4: Geometric Transformations (Rotation, Scaling, Translation, Cropping) ---
@app.route('/transform/geometry', methods=['POST'])
def transform_geometry():
    img, _ = read_image_from_request()
    if img is None: return jsonify({'error': 'No file part'}), 400
    
    op_type = request.form.get('op_type', 'rotate')
    (h, w) = img.shape[:2]
    
    if op_type == 'rotate':
        angle = float(request.form.get('angle', 0))
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        processed_img = cv2.warpAffine(img, M, (w, h)) # A.4 Rotation
        message = f'Rotated image by {angle}°.'

    elif op_type == 'scale':
        scale_x = float(request.form.get('scale_x', 1.0))
        scale_y = float(request.form.get('scale_y', 1.0))
        new_w = int(w * scale_x)
        new_h = int(h * scale_y)
        processed_img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR) # A.4 Scaling
        message = f'Scaled image by ({scale_x}, {scale_y}).'

    elif op_type == 'translate':
        tx = float(request.form.get('tx', 0))
        ty = float(request.form.get('ty', 0))
        M = np.float32([[1, 0, tx], [0, 1, ty]])
        processed_img = cv2.warpAffine(img, M, (w, h)) # A.4 Translation
        message = f'Translated image by ({tx}, {ty}) pixels.'

    elif op_type == 'crop':
        # Get relative crop values (0-100) from frontend sliders
        crop_x_rel = float(request.form.get('x', 0)) / 100.0
        crop_y_rel = float(request.form.get('y', 0)) / 100.0
        crop_w_rel = float(request.form.get('w', 100)) / 100.0
        crop_h_rel = float(request.form.get('h', 100)) / 100.0

        # Calculate absolute pixel coordinates (A.4 Cropping)
        x_start = int(w * crop_x_rel)
        y_start = int(h * crop_y_rel)
        
        x_end = int(x_start + (w * crop_w_rel))
        y_end = int(y_start + (h * crop_h_rel))
        
        # Ensure bounds are correct (especially for crop start + width/height)
        x_end = min(w, x_end)
        y_end = min(h, y_end)

        processed_img = img[y_start:y_end, x_start:x_end]
        message = f'Cropped image to W:{x_end-x_start} H:{y_end-y_start}.'
        
    else:
        return jsonify({'error': 'Invalid geometry op type'}), 400

    try:
        processed_image_hex = encode_image_to_hex(processed_img)
        return jsonify({'processed_image_hex': processed_image_hex, 'message': message})
    except Exception as e:
        return jsonify({'error': f'Transformation error: {str(e)}'}), 500

# --- A.3: Histogram Generation & Equalization ---
@app.route('/histogram', methods=['POST'])
def histogram():
    hist_type = request.form.get('hist_type', 'grayscale')
    op_type = request.form.get('op_type', 'generate') 

    if op_type == 'generate':
        # Generate histogram plot image (A.3 Histogram Analysis)
        img, _ = read_image_from_request()
        if img is None: return jsonify({'error': 'No file part'}), 400
        
        plt.clf() 
        
        if hist_type == 'grayscale':
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
            plt.plot(hist, color='black')
            plt.title('Grayscale Histogram')
        else: # 'color'
            colors = ('b', 'g', 'r')
            for i, col in enumerate(colors):
                hist = cv2.calcHist([img], [i], None, [256], [0, 256])
                plt.plot(hist, color=col)
            plt.title('Color (BGR) Histogram')
        
        plt.xlabel('Pixel Intensity')
        plt.ylabel('Pixel Count')
        plt.xlim([0, 256])
        
        # Save plot to a memory buffer and encode
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        
        plot_image_hex = buf.getvalue().hex()
        return jsonify({'processed_image_hex': plot_image_hex, 'message': f'Generated {hist_type} Histogram plot.'})

    elif op_type == 'equalize':
        # Apply histogram equalization (A.3 Histogram Equalization)
        img, _ = read_image_from_request(color_mode=cv2.IMREAD_GRAYSCALE)
        if img is None: return jsonify({'error': 'No file part'}), 400
        
        equalized_img = cv2.equalizeHist(img)
        
        try:
            processed_image_hex = encode_image_to_hex(equalized_img)
            return jsonify({'processed_image_hex': processed_image_hex, 'message': 'Applied Histogram Equalization (A.3).'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    else:
        return jsonify({'error': 'Invalid histogram op type'}), 400

# --- B.1: Smoothing Filters ---
@app.route('/filter/smooth', methods=['POST'])
def filter_smooth():
    img, _ = read_image_from_request()
    if img is None: return jsonify({'error': 'No file part'}), 400
    selected_filter = request.form.get('filter', 'median')
    kernel = int(request.form.get('kernel', 5)) 
    
    if selected_filter == 'median':
        processed_img = cv2.medianBlur(img, kernel) # B.1 Median
    elif selected_filter == 'gaussian':
        processed_img = cv2.GaussianBlur(img, (kernel, kernel), 0) # B.1 Gaussian
    elif selected_filter == 'averaging':
        processed_img = cv2.blur(img, (kernel, kernel)) # B.1 Averaging
    else:
        return jsonify({'error': 'Invalid filter type'}), 400
    try:
        processed_image_hex = encode_image_to_hex(processed_img)
        return jsonify({'processed_image_hex': processed_image_hex, 'message': f'Applied {selected_filter} filter (Kernel: {kernel}).'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- B.2: Edge Detection & Sharpening ---
@app.route('/filter/edge_sharpen', methods=['POST'])
def filter_edge_sharpen():
    img, _ = read_image_from_request()
    if img is None: return jsonify({'error': 'No file part'}), 400
    filter_type = request.form.get('filter_type', 'canny')
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    if filter_type == 'canny':
        processed_img = cv2.Canny(gray, 100, 200) # B.2 Canny
        message = 'Applied Canny Edge Detection.'
    elif filter_type == 'sobel_x':
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=5) # B.2 Sobel X
        processed_img = cv2.convertScaleAbs(sobel_x)
        message = 'Applied Sobel X.'
    elif filter_type == 'sobel_y':
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=5) # B.2 Sobel Y
        processed_img = cv2.convertScaleAbs(sobel_y)
        message = 'Applied Sobel Y.'
    elif filter_type == 'laplacian':
        lap = cv2.Laplacian(gray, cv2.CV_64F) # B.2 Laplacian
        processed_img = cv2.convertScaleAbs(lap)
        message = 'Applied Laplacian.'
    elif filter_type == 'sharpen':
        kernel = np.array([[-1, -1, -1], [-1,  9, -1], [-1, -1, -1]])
        processed_img = cv2.filter2D(img, -1, kernel) # B.2 Sharpening
        message = 'Applied Sharpening Filter.'
    else:
        return jsonify({'error': 'Invalid filter type'}), 400
    try:
        processed_image_hex = encode_image_to_hex(processed_img)
        return jsonify({'processed_image_hex': processed_image_hex, 'message': message})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- B.3: Morphological Operations ---
@app.route('/filter/morphology', methods=['POST'])
def filter_morphology():
    img, _ = read_image_from_request()
    if img is None: return jsonify({'error': 'No file part'}), 400
    op_type = request.form.get('op_type', 'erode')
    kernel_size = int(request.form.get('kernel', 5))
    kernel = np.ones((kernel_size, kernel_size), np.uint8)
    
    # Use Otsu's binary image for best results
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary_img = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    if op_type == 'erode':
        processed_img = cv2.erode(binary_img, kernel, iterations=1) # B.3 Erosion
    elif op_type == 'dilate':
        processed_img = cv2.dilate(binary_img, kernel, iterations=1) # B.3 Dilation
    elif op_type == 'opening':
        processed_img = cv2.morphologyEx(binary_img, cv2.MORPH_OPEN, kernel) # B.3 Opening
    elif op_type == 'closing':
        processed_img = cv2.morphologyEx(binary_img, cv2.MORPH_CLOSE, kernel) # B.3 Closing
    else:
        return jsonify({'error': 'Invalid operation type'}), 400
    try:
        processed_image_hex = encode_image_to_hex(processed_img)
        return jsonify({'processed_image_hex': processed_image_hex, 'message': f'Applied {op_type} (Kernel: {kernel_size}).'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- B.4: Segmentation Techniques ---
@app.route('/segmentation', methods=['POST'])
def segmentation():
    img, _ = read_image_from_request()
    if img is None: return jsonify({'error': 'No file part'}), 400
    seg_type = request.form.get('seg_type', 'otsu')
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    if seg_type == 'global_thresh':
        _, processed_img = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY) # B.4 Global Threshold
        message = 'Applied Global Threshold (127).'
    elif seg_type == 'otsu':
        _, processed_img = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU) # B.4 Otsu's Thresholding
        message = "Applied Otsu's Thresholding."
    elif seg_type == 'watershed':
        # B.4 Watershed (Region-based method)
        # Simplified implementation to demonstrate the method
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = np.ones((3, 3), np.uint8)
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
        sure_bg = cv2.dilate(opening, kernel, iterations=3)
        dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
        _, sure_fg = cv2.threshold(dist_transform, 0.7 * dist_transform.max(), 255, 0)
        sure_fg = np.uint8(sure_fg)
        unknown = cv2.subtract(sure_bg, sure_fg)
        _, markers = cv2.connectedComponents(sure_fg)
        markers = markers + 1
        markers[unknown == 255] = 0
        markers = cv2.watershed(img, markers)
        img[markers == -1] = [255, 0, 0] # Highlight boundaries in red
        processed_img = img
        message = 'Applied Watershed Segmentation.'
    else:
        return jsonify({'error': 'Invalid segmentation type'}), 400
    try:
        processed_image_hex = encode_image_to_hex(processed_img)
        return jsonify({'processed_image_hex': processed_image_hex, 'message': message})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- B.5: Frequency Domain Filtering ---
@app.route('/filter/frequency', methods=['POST'])
def filter_frequency():
    img, _ = read_image_from_request(color_mode=cv2.IMREAD_GRAYSCALE)
    if img is None: return jsonify({'error': 'No file part'}), 400
    filter_type = request.form.get('filter_type', 'lowpass_gaussian')
    cutoff = int(request.form.get('cutoff', 30))
    
    # 1. DFT and Centering
    dft = cv2.dft(np.float32(img), flags=cv2.DFT_COMPLEX_OUTPUT)
    dft_shift = np.fft.fftshift(dft)
    rows, cols = img.shape
    crow, ccol = rows // 2, cols // 2
    
    # 2. Create Mask
    mask = np.zeros((rows, cols, 2), np.float32)
    
    y, x = np.indices((rows, cols))
    d_sq = (x - ccol)**2 + (y - crow)**2
    
    if 'gaussian' in filter_type: # B.5 Gaussian Filters
        gauss_mask = np.exp(-d_sq / (2 * cutoff**2))
        if 'highpass' in filter_type:
            gauss_mask = 1 - gauss_mask
        mask[:,:,0] = gauss_mask
        mask[:,:,1] = gauss_mask
    elif 'ideal' in filter_type: # B.5 Ideal Filters
        ideal_mask = np.zeros((rows, cols), np.float32)
        r = np.sqrt(d_sq)
        if 'lowpass' in filter_type:
            ideal_mask[r <= cutoff] = 1
        else: # Highpass
            ideal_mask[r > cutoff] = 1
        mask[:,:,0] = ideal_mask
        mask[:,:,1] = ideal_mask
    else:
        return jsonify({'error': 'Invalid frequency filter type'}), 400

    # 3. Apply filter and Inverse DFT
    fshift = dft_shift * mask
    f_ishift = np.fft.ifftshift(fshift)
    img_back = cv2.idft(f_ishift)
    img_back = cv2.magnitude(img_back[:, :, 0], img_back[:, :, 1])
    
    # 4. Normalization
    cv2.normalize(img_back, img_back, 0, 255, cv2.NORM_MINMAX)
    processed_img = np.uint8(img_back)

    try:
        processed_image_hex = encode_image_to_hex(processed_img)
        return jsonify({'processed_image_hex': processed_image_hex, 'message': f'Applied Frequency Filter: {filter_type} (Cutoff: {cutoff}).'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Flask is running on port 5001 as specified in the React file
    app.run(debug=True, port=5001)