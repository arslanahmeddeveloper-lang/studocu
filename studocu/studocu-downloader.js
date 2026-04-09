document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.studocu-container');
    if (!container) return;

    const downloadBtn = document.getElementById('download-btn');
    const urlInput = document.getElementById('studocu-url');
    const clearBtn = document.getElementById('clear-btn');
    const progressSection = document.getElementById('progress-section');
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const errorIndicator = document.getElementById('error-indicator');

    // ⚠️ CHANGE THIS to your VPS domain where the backend (server.js) is running
    const API_BASE_URL = 'https://studcodl.mudassirasghar.com';

    // Clear button logic
    urlInput.addEventListener('input', () => {
        clearBtn.classList.toggle('visible', urlInput.value.length > 0);
    });
    clearBtn.addEventListener('click', () => {
        urlInput.value = '';
        clearBtn.classList.remove('visible');
        errorIndicator.style.display = 'none';
        urlInput.focus();
    });

    let pollInterval;

    const resetUI = () => {
        setLoading(false);
        progressSection.style.display = 'none';
        errorIndicator.style.display = 'none';
        progressBar.style.width = '0%';
        statusText.textContent = '';
        statusText.classList.remove('success');
        urlInput.disabled = false;
    };

    const pollProgress = (sessionId) => {
        pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/progress/${sessionId}`);
                if (!response.ok) {
                    clearInterval(pollInterval);
                    const errorData = await response.json().catch(() => ({ message: 'An unknown server error occurred.' }));
                    showError(errorData.message);
                    setLoading(false);
                    return;
                }

                const data = await response.json();
                progressBar.style.width = `${data.progress}%`;
                statusText.textContent = `${data.progress}% — ${data.message}`;

                if (data.status === 'completed') {
                    clearInterval(pollInterval);
                    statusText.textContent = '✓ Success — downloading your PDF...';
                    statusText.classList.add('success');

                    try {
                        const dlResponse = await fetch(`${API_BASE_URL}/api/download/${sessionId}`);
                        if (!dlResponse.ok) throw new Error('Download failed');
                        const blob = await dlResponse.blob();
                        const downloadUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = 'studocu-document.pdf';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(downloadUrl);
                        statusText.textContent = '✓ Download complete';
                    } catch (dlError) {
                        showError('PDF was generated but download failed. Please try again.');
                    }
                    setTimeout(resetUI, 6000);
                } else if (data.status === 'error') {
                    clearInterval(pollInterval);
                    showError(data.message || 'An unknown error occurred.');
                    setLoading(false);
                }
            } catch (error) {
                clearInterval(pollInterval);
                showError('Failed to connect to the server for progress updates.');
                setLoading(false);
            }
        }, 2000);
    };

    downloadBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url || !/^https:\/\/www\.studocu\.com\/.+$/.test(url)) {
            showError('Please provide a valid StuDocu URL starting with https://www.studocu.com/');
            return;
        }

        resetUI();
        setLoading(true);
        progressSection.style.display = 'block';
        statusText.textContent = 'Requesting download...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/request-download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to start the download process.' }));
                throw new Error(errorData.error);
            }

            const { sessionId } = await response.json();
            pollProgress(sessionId);
        } catch (error) {
            showError(error.message);
            setLoading(false);
        }
    });

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !downloadBtn.disabled) downloadBtn.click();
    });

    function setLoading(isLoading) {
        downloadBtn.disabled = isLoading;
        urlInput.disabled = isLoading;
        clearBtn.disabled = isLoading;
        downloadBtn.classList.toggle('loading', isLoading);
        if (isLoading) clearBtn.classList.remove('visible');
    }

    function showError(message) {
        errorIndicator.style.display = 'flex';
        errorIndicator.textContent = message;
        progressSection.style.display = 'none';
    }
});