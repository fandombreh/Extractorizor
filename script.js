// Ensure JSZip is loaded in your HTML
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
// Optionally include FileSaver.js: <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>

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
        // Try multiple CORS proxies
        const corsProxies = [
            'https://cors-anywhere.herokuapp.com/',
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?'
        ];

        let response;
        let proxyUsed = false;
        for (const proxy of corsProxies) {
            try {
                response = await fetch(proxy + url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                if (response.ok) {
                    proxyUsed = true;
                    break;
                }
            } catch {
                console.warn(`Proxy ${proxy} failed, trying next...`);
            }
        }

        // Fallback to direct fetch
        if (!response || !response.ok) {
            response = await fetch(url);
            proxyUsed = false;
        }

        if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const zip = new JSZip();
        zip.file('index.html', html);

        // Collect resource URLs
        const resources = [
            ...doc.querySelectorAll('img[src], script[src], link[href], video[src], audio[src], source[src], iframe[src]'),
            ...doc.querySelectorAll('a[href$=".css"], a[href$=".js"], a[href$=".png"], a[href$=".jpg"], a[href$=".jpeg"], a[href$=".gif"], a[href$=".svg"], a[href$=".woff"], a[href$=".woff2"], a[href$=".ttf"]')
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

        // Fetch resource with retry logic and proxy fallback
        const fetchResource = async (resourceUrl, retries = 2) => {
            let res;
            let currentProxy = proxyUsed ? corsProxies[0] : '';
            try {
                res = await fetch(currentProxy + resourceUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                if (!res.ok && retries > 0) {
                    for (const proxy of corsProxies) {
                        try {
                            res = await fetch(proxy + resourceUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                            if (res.ok) break;
                        } catch {
                            continue;
                        }
                    }
                }
                if (!res.ok && retries > 0) {
                    res = await fetch(resourceUrl);
                }
                if (!res.ok) throw new Error(`Failed to fetch ${resourceUrl}`);

                const blob = await res.blob();
                let filePath = new URL(resourceUrl).pathname.split('/').slice(1).join('/') || 'file';
                const contentType = res.headers.get('content-type') || '';

                // Assign file extension
                if (!filePath.includes('.')) {
                    const ext = contentType.includes('javascript') ? '.js' :
                                contentType.includes('css') ? '.css' :
                                contentType.includes('image') ? `.${contentType.split('/')[1] || 'bin'}` :
                                contentType.includes('font') ? `.${contentType.split('/')[1] || 'bin'}` : '.bin';
                    filePath += ext;
                }

                zip.file(filePath, blob);
            } catch (err) {
                if (retries > 0) {
                    return fetchResource(resourceUrl, retries - 1);
                }
                console.warn(`Could not fetch ${resourceUrl}: ${err.message}`);
            } finally {
                fetchedCount++;
                updateProgress();
            }
        };

        // Fetch resources in parallel with concurrency limit
        const concurrencyLimit = 8;
        for (let i = 0; i < uniqueResources.length; i += concurrencyLimit) {
            const batch = uniqueResources.slice(i, i + concurrencyLimit);
            await Promise.all(batch.map(resourceUrl => fetchResource(resourceUrl)));
        }

        // Generate and download ZIP
        status.textContent = 'Generating ZIP...';
        const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });

        // Fallback download if saveAs is unavailable
        if (typeof saveAs === 'function') {
            saveAs(content, 'website_files.zip');
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = 'website_files.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }

        status.textContent = 'Download started!';
    } catch (err) {
        status.textContent = `Error: ${err.message}`;
    } finally {
        if (progress) progress.style.display = 'none';
    }
}
