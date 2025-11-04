document.addEventListener('DOMContentLoaded', () => {
    // Check if the downloader container exists on the page to run the script
    const container = document.querySelector('.studocu-container');
    if (!container) {
        return; // Exit if the downloader HTML is not on the current page
    }

    const downloadBtn = document.getElementById('download-btn');
    const urlInput = document.getElementById('studocu-url');
    const progressSection = document.getElementById('progress-section');
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const errorIndicator = document.getElementById('error-indicator');

    // const API_BASE_URL = 'http://localhost:7860';
    const API_BASE_URL = 'https://devusman-test.hf.space';

    let pollInterval;

    const resetUI = () => {
        setLoading(false);
        progressSection.style.display = 'none';
        errorIndicator.style.display = 'none';
        progressBar.style.width = '0%';
        statusText.textContent = '';
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
                statusText.textContent = `(${data.progress}%) ${data.message}`;

                if (data.status === 'completed') {
                    clearInterval(pollInterval);
                    statusText.textContent = '✅ Success! Your download will start now.';
                    window.location.href = `${API_BASE_URL}/api/download/${sessionId}`;
                    setTimeout(resetUI, 5000);
                } else if (data.status === 'error') {
                    clearInterval(pollInterval);
                    showError(`Error: ${data.message || 'An unknown error occurred.'}`);
                    setLoading(false);
                }

            } catch (error) {
                clearInterval(pollInterval);
                console.error('Polling failed:', error);
                showError('Failed to connect to the server for progress updates.');
                setLoading(false);
            }
        }, 2000);
    };

    downloadBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        const studocuUrlPattern = /^https:\/\/www\.studocu\.com\/.+$/;

        if (!url || !studocuUrlPattern.test(url)) {
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
            console.error('Download initiation failed:', error);
            showError(error.message);
            setLoading(false);
        }
    });

    function setLoading(isLoading) {
        downloadBtn.disabled = isLoading;
        urlInput.disabled = isLoading;
        downloadBtn.classList.toggle('loading', isLoading);
    }

    function showError(message) {
        errorIndicator.style.display = 'block';
        errorIndicator.textContent = message;
        progressSection.style.display = 'none';
    }
});