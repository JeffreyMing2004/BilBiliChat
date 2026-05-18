export function initializeShortcuts(shortcuts: {
  reconnect: () => void
  clearMessages: () => void
  toggleObs: () => void
  openSettings: () => void
}): () => void {
  const handler = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) {
      return
    }

    const key = event.key.toLowerCase()

    if (key === 'r') {
      event.preventDefault()
      shortcuts.reconnect()
    }

    if (key === 'd') {
      event.preventDefault()
      shortcuts.clearMessages()
    }

    if (key === 'o') {
      event.preventDefault()
      shortcuts.toggleObs()
    }

    if (key === 's') {
      event.preventDefault()
      shortcuts.openSettings()
    }
  }

  window.addEventListener('keydown', handler)

  return () => {
    window.removeEventListener('keydown', handler)
  }
}
