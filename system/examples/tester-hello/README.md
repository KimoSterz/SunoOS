# Hello Suno

A native SunoUI example for a running, qualified tester guest. From the repository:

```sh
Suno-tester dev /path/to/mobile.json ./examples/tester-hello -- python3 main.py
```

Edit `message.txt` in your host checkout. The watcher syncs the source and restarts
the guest app. The same source runs in a desktop guest. No dependency installation
or build step is needed when the image includes SunoUI and Python.
