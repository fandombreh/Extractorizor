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

    status.textContent = 'Requesting files from server...';

    try {
        // Send request to server-side API
        const response = await fetch(`/api/extract?url=${encodeURIComponent(url)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/zip'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch files from server');

        // Get the ZIP file as a blob
        const blob = await response.blob();

        // Trigger download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'website_files.zip';
        link.click();
        status.textContent = 'Download started!';
    } catch (err) {
        status.textContent = `Error: ${err.message}`;
    }
}
