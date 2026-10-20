/**
 * Floating Chatbot Widget Controller
 * Manages chat window, message sending, rendering.
 */

const ChatbotWidget = (() => {
  let currentSessionId = null;
  let markdownRenderer = null;
  let isLoading = false;

  function init() {
    // Setup markdown-it
    markdownRenderer = window.markdownit({
      html: false,
      linkify: true,
      typographer: true
    });

    // Event listeners
    document.getElementById('chatbot-toggle').addEventListener('click', toggleWindow);
    document.getElementById('chatbot-close').addEventListener('click', closeWindow);
    document.getElementById('chatbot-expand').addEventListener('click', toggleExpand);
    document.getElementById('chatbot-form').addEventListener('submit', handleSendMessage);
    document.getElementById('chatbot-new-conv').addEventListener('click', handleNewConversation);
    document.getElementById('chatbot-new-hint').addEventListener('click', (e) => {
      e.preventDefault();
      handleNewConversation();
    });

    console.log('[ChatbotWidget] Initialized');
  }

  function toggleWindow() {
    const window = document.getElementById('chatbot-window');
    if (window.style.display === 'none') {
      window.style.display = 'flex';
      document.getElementById('chatbot-input').focus();
    } else {
      closeWindow();
    }
  }

  function closeWindow() {
    document.getElementById('chatbot-window').style.display = 'none';
  }

  function toggleExpand() {
    const window = document.getElementById('chatbot-window');
    const isExpanded = window.classList.contains('expanded');

    if (isExpanded) {
      window.classList.remove('expanded');
    } else {
      window.classList.add('expanded');
    }

    // Resize Plotly charts after layout changes
    setTimeout(() => {
      resizeCharts();
    }, 300); // Wait for CSS transition to complete
  }

  function resizeCharts() {
    // Resize all Plotly charts in the message area
    const plotlyDivs = document.querySelectorAll('[data-plotly-plot-id]');
    plotlyDivs.forEach(div => {
      if (window.Plotly) {
        try {
          window.Plotly.Plots.resize(div);
        } catch (e) {
          console.debug('Plotly resize skipped:', e.message);
        }
      }
    });
  }

  async function handleNewConversation() {
    try {
      const response = await fetch('/chat/new', { method: 'POST' });
      const data = await response.json();

      if (data.status === 'success') {
        currentSessionId = null;
        // Clear messages and show initial message
        const messagesDiv = document.getElementById('chatbot-messages');
        messagesDiv.innerHTML = `
          <div class="chatbot-message system">
            <div class="message-content">
              <p>Hi! I can help answer questions about the Copernicus dashboard. What would you like to know?</p>
            </div>
          </div>
        `;
        document.getElementById('chatbot-input').focus();
      } else {
        addErrorMessage('Failed to start new conversation');
      }
    } catch (error) {
      console.error('Error starting new conversation:', error);
      addErrorMessage('Failed to start new conversation');
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (isLoading) return;

    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();

    if (!message) return;

    input.value = '';
    addUserMessage(message);
    setLoading(true);

    // Remember if user was near the bottom when they sent the message
    const container = document.getElementById('chatbot-messages');
    const wasNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 80;

    const startTime = Date.now();
    let loadingMessageDiv = null;
    let stillWorkingTimer = null;

    function updateElapsedTime() {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);

      if (!loadingMessageDiv) {
        loadingMessageDiv = document.createElement('div');
        loadingMessageDiv.className = 'chatbot-message system';
        const content = document.createElement('div');
        content.className = 'message-content';
        loadingMessageDiv.appendChild(content);
        document.getElementById('chatbot-messages').appendChild(loadingMessageDiv);
      }

      const content = loadingMessageDiv.querySelector('.message-content');
      if (elapsed >= 20) {
        content.innerHTML = `<p>Working for ${elapsed}s... Still working, this can take a few minutes.</p>`;
      } else {
        content.innerHTML = `<p>Waiting (${elapsed}s)...</p>`;
      }
    }

    // Start showing elapsed time
    updateElapsedTime();
    stillWorkingTimer = setInterval(updateElapsedTime, 1000);

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      const data = await response.json();

      if (data.status === 'error') {
        handleError(data);
        setLoading(false);
        return;
      }

      currentSessionId = data.session_id;
      await renderAssistantMessage(data, wasNearBottom);

    } catch (error) {
      console.error('Chat error:', error);
      addErrorMessage('Failed to send message. Please try again.');
    } finally {
      // Clear loading message and timer
      if (loadingMessageDiv) {
        loadingMessageDiv.remove();
      }
      if (stillWorkingTimer) {
        clearInterval(stillWorkingTimer);
      }
      setLoading(false);
      input.focus();
    }
  }

  async function renderAssistantMessage(apiResponse, wasNearBottom = true) {
    const {
      response: fullResponse,
      session_id: sessionId
    } = apiResponse;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chatbot-message assistant';
    const mountFunctions = [];

    // Parse response into ordered segments (prose and markers)
    const { segments, markers } = MarkerParser.extractMarkers(fullResponse);

    // Fetch artifacts for all markers
    const artifactIds = MarkerParser.getArtifactsToFetch(markers);
    let artifacts = new Map();

    if (artifactIds.length > 0) {
      console.debug(`Fetching ${artifactIds.length} artifacts:`, artifactIds);
      artifacts = await ArtifactFetcher.fetchArtifacts(artifactIds, sessionId);
    }

    // Render segments in order
    segments.forEach((segment) => {
      if (segment.type === 'prose') {
        // Render prose with markdown
        const proseDiv = document.createElement('div');
        proseDiv.className = 'message-content';
        proseDiv.innerHTML = markdownRenderer.render(segment.text);
        messageDiv.appendChild(proseDiv);

        // Schedule KaTeX auto-render on this prose element
        if (window.katex && window.renderMathInElement) {
          mountFunctions.push(() => {
            try {
              renderMathInElement(proseDiv, {
                delimiters: [
                  { left: '$$', right: '$$', display: true },
                  { left: '$', right: '$', display: false }
                ],
                throwOnError: false
              });
            } catch (e) {
              console.error('KaTeX auto-render error:', e);
            }
          });
        }
      } else if (segment.type === 'marker') {
        const marker = segment.marker;
        try {
          let result = null;

          switch (marker.type) {
            case MarkerParser.MarkerType.TABULAR:
              {
                const artifact = artifacts.get(marker.attributes.data_id);
                if (artifact?.status === 'success') {
                  result = WidgetRenderer.renderTable(artifact.data, marker.attributes);
                } else if (!artifact) {
                  result = { html: renderLoadingSpinner(), mount: null };
                } else {
                  result = { html: renderArtifactError(artifact), mount: null };
                }
              }
              break;

            case MarkerParser.MarkerType.TEMPORAL_PLOT:
              {
                const artifact = artifacts.get(marker.attributes.data_id);
                if (artifact?.status === 'success') {
                  result = WidgetRenderer.renderTemporalPlot(artifact.data, marker.attributes);
                } else if (!artifact) {
                  result = { html: renderLoadingSpinner(), mount: null };
                } else {
                  result = { html: renderArtifactError(artifact), mount: null };
                }
              }
              break;

            case MarkerParser.MarkerType.COUNT_HISTOGRAM:
              {
                const artifact = artifacts.get(marker.attributes.data_id);
                if (artifact?.status === 'success') {
                  result = WidgetRenderer.renderCountHistogram(artifact.data, marker.attributes);
                } else if (!artifact) {
                  result = { html: renderLoadingSpinner(), mount: null };
                } else {
                  result = { html: renderArtifactError(artifact), mount: null };
                }
              }
              break;

            case MarkerParser.MarkerType.EVENT_CALENDAR:
              {
                const artifact = artifacts.get(marker.attributes.data_id);
                if (artifact?.status === 'success') {
                  result = WidgetRenderer.renderEventCalendar(artifact.data, marker.attributes);
                } else if (!artifact) {
                  result = { html: renderLoadingSpinner(), mount: null };
                } else {
                  result = { html: renderArtifactError(artifact), mount: null };
                }
              }
              break;

            case MarkerParser.MarkerType.KPI:
              if (marker.attributes.data_id) {
                const artifact = artifacts.get(marker.attributes.data_id);
                if (artifact?.status === 'success') {
                  result = { html: '<div class="alert alert-info alert-sm">KPI: ' + escapeHtml(marker.attributes.title || 'Metrics') + '</div>', mount: null };
                } else if (!artifact) {
                  result = { html: renderLoadingSpinner(), mount: null };
                } else {
                  result = { html: renderArtifactError(artifact), mount: null };
                }
              } else if (marker.attributes.label && marker.attributes.value) {
                result = WidgetRenderer.renderDirectKPI(marker.attributes);
              }
              break;
          }

          if (result && result.html) {
            const widgetContainer = document.createElement('div');
            widgetContainer.className = `widget widget-${marker.type}`;
            widgetContainer.innerHTML = result.html;
            messageDiv.appendChild(widgetContainer);

            // Store mount function for later
            if (result.mount) {
              mountFunctions.push(() => result.mount(widgetContainer));
            }
          }

        } catch (error) {
          console.error(`Error rendering ${marker.type} widget:`, error);
          const errorDiv = document.createElement('div');
          errorDiv.className = 'alert alert-danger alert-sm';
          errorDiv.textContent = `Error rendering widget: ${error.message}`;
          messageDiv.appendChild(errorDiv);
        }
      }
    });

    document.getElementById('chatbot-messages').appendChild(messageDiv);

    // If user was near bottom when they sent the message, scroll to show the response
    if (wasNearBottom) {
      messageDiv.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    // Call all mount functions (widgets + KaTeX rendering) after insertion
    setTimeout(() => {
      mountFunctions.forEach(mount => {
        try {
          mount();
        } catch (e) {
          console.error('Mount/render error:', e);
        }
      });
    }, 0);
  }

  function renderLoadingSpinner() {
    return '<div class="widget-loading"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div> Loading...</div>';
  }

  function renderArtifactError(artifact) {
    if (!artifact) {
      return '<div class="alert alert-warning alert-sm">This data is no longer available, please ask again.</div>';
    }
    if (artifact.status === 'loading') {
      return renderLoadingSpinner();
    }
    if (artifact.status === 'error') {
      if (artifact.code === 'artifact_not_found' || artifact.code === 'session_expired') {
        return '<div class="alert alert-warning alert-sm">This data is no longer available, please ask again.</div>';
      }
      return `<div class="alert alert-danger alert-sm">${escapeHtml(artifact.message)}</div>`;
    }
    return '<div class="alert alert-warning alert-sm">Could not load artifact data</div>';
  }

  function handleError(data) {
    const { code, message } = data;

    if (code === 'conversation_expired') {
      currentSessionId = null;
      addErrorMessage(message || 'This conversation is no longer available. Starting a new one.');
    } else if (code === 'invalid_request') {
      addErrorMessage(`Invalid request: ${message}`);
    } else {
      addErrorMessage(message || `Error: ${message}`);
    }
  }

  function addUserMessage(message) {
    const div = document.createElement('div');
    div.className = 'chatbot-message user';
    div.innerHTML = `<div class="message-content">${escapeHtml(message)}</div>`;
    document.getElementById('chatbot-messages').appendChild(div);
    scrollToBottom(true);
  }

  function addErrorMessage(message) {
    const div = document.createElement('div');
    div.className = 'chatbot-message error';
    div.innerHTML = `<div class="message-content alert alert-danger alert-sm" style="margin: 0;">${escapeHtml(message)}</div>`;
    document.getElementById('chatbot-messages').appendChild(div);
    scrollToBottom();
  }

  
  function setLoading(visible) {
    isLoading = visible;
    const input = document.getElementById('chatbot-input');
    const button = document.querySelector('#chatbot-form button[type="submit"]');
    input.disabled = visible;
    button.disabled = visible;
  }

  function scrollToBottom(force = false) {
    const container = document.getElementById('chatbot-messages');
    setTimeout(() => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 80;
      if (force || isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  }

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();
