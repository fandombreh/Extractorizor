async function extractFiles() {
    const urlInput = document.getElementById('urlInput').value;
    const status = document.getElementById('status');
    
    if (!urlInput) {
        status.textContent = 'Please enter a valid URL.';
        return;
    }

    // Ensure URL starts with http:// or https://
    let url = urlInput;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    status.textContent = 'Fetching resources...';

    try {
        // Fetch the HTML content of the URL
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Failed to fetch URL');
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Create a new ZIP file
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded');
        }
        const zip = new JSZip();

        // Add the HTML content to the ZIP
        zip.file('index.html', html);

        // Collect all elements with src or href attributes
        const resources = [
            ...doc.querySelectorAll('[src]'), // Elements with src (img, script, video, audio, source, etc.)
            ...doc.querySelectorAll('[href]')  // Elements with href (link, a, etc.)
        ];

        // Fetch each resource and add to ZIP
        for (const resource of resources) {
            const resourceUrl = resource.src || resource.href;
            if (resourceUrl && resourceUrl.startsWith('http')) {
                try {
                    const res = await fetch(resourceUrl, { mode: 'cors' });
                    if (!res.ok) throw new Error(`Failed to fetch ${resourceUrl}`);
                    const blob = await res.blob();
                    // Use URL pathname to maintain folder structure
                    const urlObj = new URL(resourceUrl);
                    const filePath = urlObj.pathname.split('/').slice(1).join('/') || 'file';
                    zip.file(filePath, blob);
                } catch (err) {
                    console.warn(`Could not fetch ${resourceUrl}: ${err.message}`);
                }
            }
        }

        // Generate and download the ZIP
        status.textContent = 'Generating ZIP...';
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'website_files.zip';
        link.click();
        status.textContent = 'Download started!';
    } catch (err) {
        status.textContent = `Error: ${err.message}`;
    }
}
