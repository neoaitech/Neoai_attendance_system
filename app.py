import os
import sys

# Ensure root directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

try:
    import gradio as gr
    from backend.app.main import app
    demo = gr.Blocks(title="VisionAttend AI")
    with demo:
        gr.Markdown("## VisionAttend AI Attendance Platform API Server")
    app = gr.mount_gradio_app(app, demo, path="/gradio")
except ImportError:
    from backend.app.main import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
