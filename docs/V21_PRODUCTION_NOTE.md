# v21 production note

v21 keeps local game creation/playback fully functional even when the remote publish backend is unavailable. The Publish control is health-gated and will not attempt a cloud publish until the Worker API reports healthy.
