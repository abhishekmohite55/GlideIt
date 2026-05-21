import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

self.onmessage = async (event) => {
  const { graph } = event.data;
  try {
    const result = await elk.layout(graph);
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};
