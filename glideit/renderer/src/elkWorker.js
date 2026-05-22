import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

globalThis.onmessage = async (event) => {
  const { graph } = event.data;
  try {
    const result = await elk.layout(graph);
    globalThis.postMessage({ success: true, result });
  } catch (error) {
    globalThis.postMessage({ success: false, error: error.message });
  }
};
