/**
 * Client-side artifact fetcher with caching.
 * Implements UI Integration Guide §3-4: lazy-loading, session scoping, 404 handling.
 */

const ArtifactFetcher = (() => {
  const cache = new Map();

  async function fetchArtifact(dataId, sessionId) {
    const cacheKey = `${dataId}:${sessionId}`;
    if (cache.has(cacheKey)) {
      console.debug(`[ArtifactFetcher] Cache hit: ${dataId}`);
      return cache.get(cacheKey);
    }

    try {
      const url = `/chat/data/${dataId}?session_id=${encodeURIComponent(sessionId)}`;
      console.debug(`[ArtifactFetcher] Fetching ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const jsonData = await response.json();

      if (!response.ok) {
        console.error(`[ArtifactFetcher] HTTP ${response.status}:`, jsonData);
        return jsonData;
      }

      if (jsonData.status !== 'success') {
        return jsonData;
      }

      const artifact = jsonData.data;
      cache.set(cacheKey, { status: 'success', data: artifact });

      return { status: 'success', data: artifact };

    } catch (error) {
      console.error(`[ArtifactFetcher] Network error:`, error);
      return {
        status: 'error',
        code: 'network_error',
        message: `Failed to fetch artifact: ${error.message}`
      };
    }
  }

  async function fetchArtifacts(dataIds, sessionId) {
    const promises = dataIds.map(id =>
      fetchArtifact(id, sessionId).then(result => [id, result])
    );
    const results = await Promise.all(promises);
    return new Map(results);
  }

  function clearCache() {
    cache.clear();
    console.debug('[ArtifactFetcher] Cache cleared');
  }

  return { fetchArtifact, fetchArtifacts, clearCache };
})();
