# Contributing to GlideIt

Thank you for your interest in contributing!

## Development Setup

### Python
```bash
git clone https://github.com/abhishekmohite55/GlideIt
cd GlideIt
pip install -e ".[dev]"
```

### Renderer (Node.js required)
```bash
cd glideit/renderer
npm install
npm run dev
```

## Running Tests
```bash
pytest tests/
```

## Submitting Changes
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes with a clear message
4. Open a Pull Request against `main`

## Reporting Bugs
Please open an issue at https://github.com/abhishekmohite55/GlideIt/issues
Include: OS, Python version, the command you ran, and the full error output.
