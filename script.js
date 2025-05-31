async function extractFiles() {
    const urlInput = document.getElementById('urlInput').value;
    const status = document.getElementById('status');
    
    if (!urlInput) {
        status.textContent = 'Please enter a valid URL.';
        return;
    }

    status.textContent = 'Fetching resources...';

    try {
        // Fetch the HTML content of the URL
        const response = await fetch(urlInput);
        if (!response.ok) throw new Error('Failed to fetch URL');
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Create a new ZIP file
        const zip = new JSZip();

        // Add the HTML content to the ZIP
        zip.file('index.html', html);

        // Collect all src and href attributes (images, scripts, stylesheets)
        const resources = [
            ...doc.querySelectorAll('img[src]'),
            ...doc.querySelectorAll('script[src]'),
            ...doc.querySelectorAll('link[href][rel="stylesheet"]')
        ];

        // Fetch each resource and add to ZIP
        for (const resource of resources) {
            const url = resource.src || resource.href;
            if (url) {
                try {
                    const res = await fetch(url, { mode: 'cors' });
                    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
                    const blob = await res.blob();
                    const fileName = url.split('/').pop() || 'file';
                    zip.file(fileName, blob);
                } catch (err) {
                    console.warn(`Could not fetch ${url}: ${err.message}`);
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
