Since you already have the HTML and CSS and only need a JavaScript script to handle the file extraction into a ZIP while bypassing CORS restrictions without a backend, I'll provide an improved JavaScript script. Bypassing CORS in a browser is challenging because browsers enforce the Same-Origin Policy, but we can use techniques like a proxy service (e.g., a public CORS proxy) to fetch resources. Below is an optimized JavaScript script that improves your original code, handles large websites better, and attempts to bypass CORS using a proxy while staying client-side.

javascript

Copy
// Ensure JSZip and FileSaver.js are loaded in your HTML
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>

async function extractFiles() {
    const urlInput = document.getElementById('urlInput').value.trim();
    const status = document.getElementById('status');
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const progress = document.getElementById('progress');

    if (!urlInput) {
        status.textContent = 'Please enter a valid URL.';
        return;
    }

    let url = urlInput;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    try {
        new URL(url); // Validate URL
    } catch {
        status.textContent = 'Invalid URL format.';
        return;
    }

    status.textContent = 'Fetching resources...';
    if (progress) {
        progress.style.display = 'block';
        progressText.textContent = '0%';
        progressFill.style.width = '0%';
    }

    try {
        // Use a CORS proxy to bypass restrictions
        const corsProxy = 'https://cors-anywhere.herokuapp.com/';
        const response = await fetch(corsProxy + url);
        if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const zip = new JSZip();
        zip.file('index.html', html);

        // Collect unique resource URLs
        const resources = [
            ...doc.querySelectorAll('img[src], script[src], link[href], video[src], audio[src], source[src], iframe[src]'),
            ...doc.querySelectorAll('a[href$=".css"], a[href$=".js"], a[href$=".png"], a[href$=".jpg"], a[href$=".jpeg"], a[href$=".gif"], a[href$=".svg"]')
        ].map(el => el.src || el.href).filter(url => url && (url.startsWith('http') || url.startsWith('/')));

        // Resolve relative URLs
        const baseUrl = new URL(url);
        const absoluteResources = resources.map(res => {
            if (res.startsWith('/')) {
                return baseUrl.origin + res;
            }
            return res;
        });

        const uniqueResources = [...new Set(absoluteResources)];
        const totalResources = uniqueResources.length;
        let fetchedCount = 0;

        // Update progress
        const updateProgress = () => {
            const percentage = totalResources ? Math.round((fetchedCount / totalResources) * 100) : 100;
            if (progressText && progressFill) {
                progressText.textContent = `${percentage}%`;
                progressFill.style.width = `${percentage}%`;
            }
        };

        // Fetch resource with retry logic
        const fetchResource = async (resourceUrl, retries = 2) => {
            try {
                // Try with proxy first
                let res = await fetch(corsProxy + resourceUrl);
                if (!res.ok && retries > 0) {
                    // Retry without proxy if proxy fails
                    res = await fetch(resourceUrl);
                }
                if (!res.ok) throw new Error(`Failed to fetch ${resourceUrl}`);

                const blob = await res.blob();
                let filePath = new URL(resourceUrl).pathname.split('/').slice(1).join('/') || 'file';
                const contentType = res.headers.get('content-type') || '';
                
                // Assign file extension based on content type
                if (!filePath.includes('.')) {
                    const ext = contentType.includes('javascript') ? '.js' :
                                contentType.includes('css') ? '.css' :
                                contentType.includes('image') ? `.${contentType.split('/')[1] || 'bin'}` : '.bin';
                    filePath += ext;
                }

                zip.file(filePath, blob);
            } catch (err) {
                if (retries > 0) {
                    return fetchResource(resourceUrl, retries - 1); // Retry
                }
                console.warn(`Could not fetch ${resourceUrl}: ${err.message}`);
            } finally {
                fetchedCount++;
                updateProgress();
            }
        };

        // Fetch resources in parallel with concurrency limit
        const concurrencyLimit = 10;
        for (let i = 0; i < uniqueResources.length; i += concurrencyLimit) {
            const batch = uniqueResources.slice(i, i + concurrencyLimit);
            await Promise.all(batch.map(resourceUrl => fetchResource(resourceUrl)));
        }

        // Generate and download ZIP
        status.textContent = 'Generating ZIP...';
        const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        saveAs(content, 'website_files.zip');
        status.textContent = 'Download started!';
    } catch (err) {
        status.textContent = `Error: ${err.message}`;
    } finally {
        if (progress) progress.style.display = 'none';
    }
}
