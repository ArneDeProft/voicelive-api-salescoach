/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef } from 'react'

export function useWebRTC(onSendOffer: (sdp: string) => void) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const isSettingUpRef = useRef(false)
  const onSendOfferRef = useRef(onSendOffer)

  // Keep the callback ref up to date
  useEffect(() => {
    onSendOfferRef.current = onSendOffer
  }, [onSendOffer])

  const setupWebRTC = useCallback(
    async (iceServers: any, username?: string, password?: string) => {
      // Prevent concurrent setup calls
      if (isSettingUpRef.current) {
        console.log('[WebRTC] Setup already in progress, skipping duplicate call')
        return
      }

      isSettingUpRef.current = true

      // Clean up existing connection first
      if (pcRef.current) {
        console.log('[WebRTC] Closing existing peer connection')
        pcRef.current.close()
        pcRef.current = null
      }

      // Clean up existing audio element
      if (audioElementRef.current) {
        console.log('[WebRTC] Removing existing audio element')
        audioElementRef.current.srcObject = null
        audioElementRef.current.remove()
        audioElementRef.current = null
      }

      let servers = Array.isArray(iceServers)
        ? iceServers
        : [{ urls: iceServers }]
      if (username && password) {
        servers = servers.map(s => ({
          urls: typeof s === 'string' ? s : s.urls,
          username,
          credential: password,
          credentialType: 'password' as const,
        }))
      }

      console.log('[WebRTC] Creating new peer connection')
      const pc = new RTCPeerConnection({
        iceServers: servers,
        bundlePolicy: 'max-bundle',
      })

      pc.onicecandidate = e => {
        if (!e.candidate && pc.localDescription) {
          const sdp = btoa(
            JSON.stringify({
              type: 'offer',
              sdp: pc.localDescription.sdp,
            })
          )
          onSendOfferRef.current(sdp)
        }
      }

      pc.ontrack = e => {
        console.log(`[WebRTC] Received ${e.track.kind} track`)
        if (e.track.kind === 'video' && videoRef.current) {
          videoRef.current.srcObject = e.streams[0]
          videoRef.current.play().catch(err =>
            console.error('[WebRTC] Video play error:', err)
          )
        } else if (e.track.kind === 'audio') {
          console.log('[WebRTC] Setting up audio element')
          // Remove old audio element if it exists
          if (audioElementRef.current) {
            audioElementRef.current.srcObject = null
            audioElementRef.current.remove()
          }

          const audio = document.createElement('audio')
          audio.srcObject = e.streams[0]
          audio.autoplay = true
          audio.muted = false
          audio.volume = 1.0
          audio.style.display = 'none'
          document.body.appendChild(audio)
          audioElementRef.current = audio

          audio.play().catch(err => {
            console.error('[WebRTC] Audio play error:', err)
            // Try to play again after user interaction
            document.addEventListener('click', () => {
              audio.play().catch(e => console.error('[WebRTC] Retry audio play error:', e))
            }, { once: true })
          })

          console.log('[WebRTC] Audio element created and playing')
        }
      }

      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.addTransceiver('audio', { direction: 'recvonly' })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      pcRef.current = pc
      isSettingUpRef.current = false
    },
    []
  )

  const handleAnswer = useCallback(async (msg: any) => {
    if (!pcRef.current || pcRef.current.signalingState !== 'have-local-offer')
      return

    const sdp = msg.server_sdp
      ? JSON.parse(atob(msg.server_sdp)).sdp
      : msg.sdp || msg.answer

    if (sdp) {
      await pcRef.current.setRemoteDescription({ type: 'answer', sdp })
    }
  }, [])

  useEffect(() => {
    return () => {
      console.log('[WebRTC] Cleanup on unmount')
      pcRef.current?.close()
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = null
        audioElementRef.current.remove()
        audioElementRef.current = null
      }
    }
  }, [])

  return {
    setupWebRTC,
    handleAnswer,
    videoRef,
  }
}