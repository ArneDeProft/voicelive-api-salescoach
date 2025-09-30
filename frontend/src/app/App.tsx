/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  Dialog,
  DialogBody,
  DialogSurface,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AssessmentPanel } from '../components/AssessmentPanel'
import { ChatPanel } from '../components/ChatPanel'
import { ScenarioList } from '../components/ScenarioList'
import { VideoPanel } from '../components/VideoPanel'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useRealtime } from '../hooks/useRealtime'
import { useRecorder } from '../hooks/useRecorder'
import { useScenarios } from '../hooks/useScenarios'
import { useWebRTC } from '../hooks/useWebRTC'
import { api } from '../services/api'
import { Assessment } from '../types'

const useStyles = makeStyles({
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalL,
  },
  mainLayout: {
    width: '95%',
    maxWidth: '1400px',
    height: '90vh',
    display: 'flex',
    gap: tokens.spacingHorizontalL,
  },
  setupDialog: {
    maxWidth: '600px',
    width: '90vw',
  },
  loadingContent: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    width: '100%',
  },
})

export default function App() {
  const styles = useStyles()
  const [showSetup, setShowSetup] = useState(true) // Start as true, will be set to false if predefined agent exists
  const [showLoading, setShowLoading] = useState(false)
  const [showAssessment, setShowAssessment] = useState(false)
  const [currentAgent, setCurrentAgent] = useState<string | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [selectedScenarioData, setSelectedScenarioData] = useState<any>(null)
  const [predefinedAgentId, setPredefinedAgentId] = useState<string | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [hasPredefinedAgent, setHasPredefinedAgent] = useState(false)

  const { scenarios, selectedScenario, setSelectedScenario, loading } =
    useScenarios()
  const { playAudio } = useAudioPlayer()
  const activeScenario =
    selectedScenarioData ||
    scenarios.find(s => s.id === selectedScenario) ||
    null

  // Check for predefined agent on startup
  useEffect(() => {
    const checkPredefinedAgent = async () => {
      try {
        const config = await api.getConfig()
        console.log('[DEBUG] Config received:', JSON.stringify(config))
        console.log('[DEBUG] Type of has_predefined_agent:', typeof config.has_predefined_agent, 'Value:', config.has_predefined_agent)
        console.log('[DEBUG] Type of predefined_agent_id:', typeof config.predefined_agent_id, 'Value:', config.predefined_agent_id)
        console.log('[DEBUG] Condition check:', config.has_predefined_agent === true, '&&', !!config.predefined_agent_id)

        if (config.has_predefined_agent === true && config.predefined_agent_id) {
          console.log('[DEBUG] ✓ Predefined agent detected - hiding popup')
          setPredefinedAgentId(config.predefined_agent_id)
          setCurrentAgent(config.predefined_agent_id)
          setHasPredefinedAgent(true)
          setShowSetup(false)
        } else {
          console.log('[DEBUG] ✗ No predefined agent - showing popup')
          // No predefined agent, show setup dialog
          setHasPredefinedAgent(false)
          setShowSetup(true)
        }

      } catch (error) {
        console.error('[DEBUG] Failed to check predefined agent:', error)
        // On error, show setup dialog
        setHasPredefinedAgent(false)
        setShowSetup(true)
      } finally {
        setConfigLoading(false)
        console.log('[DEBUG] Config loading complete')
      }
    }

    checkPredefinedAgent()
  }, [])

  // Use a ref to avoid circular dependency between useWebRTC and useRealtime
  const sendRef = useRef<((data: any) => void) | null>(null)

  const sendOffer = useCallback((sdp: string) => {
    sendRef.current?.({ type: 'session.avatar.connect', client_sdp: sdp })
  }, [])

  const { setupWebRTC, handleAnswer, videoRef } = useWebRTC(sendOffer)

  const handleWebRTCMessage = useCallback((msg: any) => {
    if (msg.type === 'session.updated') {
      const session = msg.session
      const servers =
        session?.avatar?.ice_servers ||
        session?.rtc?.ice_servers ||
        session?.ice_servers
      const username =
        session?.avatar?.username ||
        session?.avatar?.ice_username ||
        session?.rtc?.ice_username ||
        session?.ice_username
      const credential =
        session?.avatar?.credential ||
        session?.avatar?.ice_credential ||
        session?.rtc?.ice_credential ||
        session?.ice_credential

      if (servers) {
        setupWebRTC(servers, username, credential)
      }
    } else if (
      (msg.server_sdp || msg.sdp || msg.answer) &&
      msg.type !== 'session.update'
    ) {
      handleAnswer(msg)
    }
  }, [setupWebRTC, handleAnswer])

  const { connected, messages, send, clearMessages, getRecordings } =
    useRealtime({
      agentId: currentAgent || predefinedAgentId,
      onMessage: handleWebRTCMessage,
      onAudioDelta: playAudio,
    })

  // Update the ref when send is available
  useEffect(() => {
    sendRef.current = send
  }, [send])

  const sendAudioChunk = useCallback(
    (base64: string) => {
      send({ type: 'input_audio_buffer.append', audio: base64 })
    },
    [send]
  )

  const { recording, toggleRecording, getAudioRecording } =
    useRecorder(sendAudioChunk)

  const handleStart = async () => {
    if (!selectedScenario) return

    try {
      // Clean up any existing connections before starting new one
     // console.log('Cleaning up existing connections before starting new scenario...')
     // cleanupWebRTC()

      const { agent_id } = await api.createAgent(selectedScenario)
      setCurrentAgent(agent_id)
      setShowSetup(false)
    } catch (error) {
      console.error('Failed to create agent:', error)
    }
  }

  const handleAnalyze = async () => {
    const scenarioIdToUse = selectedScenario || (predefinedAgentId ? 'predefined' : null)
    if (!scenarioIdToUse) return

    const recordings = getRecordings()
    const audioData = getAudioRecording()

    if (!recordings.conversation.length) return

    setShowLoading(true)

    try {
      const transcript = recordings.conversation
        .map((m: any) => `${m.role}: ${m.content}`)
        .join('\n')

      const result = await api.analyzeConversation(
        scenarioIdToUse,
        transcript,
        [...audioData, ...recordings.audio],
        recordings.conversation
      )

      setAssessment(result)
      setShowAssessment(true)
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setShowLoading(false)
    }
  }

  const handleScenarioGenerated = useCallback((scenario: any) => {
    setSelectedScenarioData(scenario)
  }, [])

  const dialogShouldOpen = !configLoading && showSetup && !hasPredefinedAgent
  console.log('[DEBUG] Dialog render check:', {
    configLoading,
    showSetup,
    hasPredefinedAgent,
    dialogShouldOpen
  })

  return (
    <div className={styles.container}>
      <Dialog
        open={dialogShouldOpen}
        onOpenChange={(_, data) => setShowSetup(data.open)}
      >
        <DialogSurface className={styles.setupDialog}>
          <DialogBody>
            {loading ? (
              <Spinner label="Loading scenarios..." />
            ) : (
              <ScenarioList
                scenarios={scenarios}
                selectedScenario={selectedScenario}
                onSelect={setSelectedScenario}
                onStart={handleStart}
                onScenarioGenerated={handleScenarioGenerated}
              />
            )}
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={showLoading}>
        <DialogSurface>
          <DialogBody>
            <div className={styles.loadingContent}>
              <Spinner size="large" />
              <Text
                size={400}
                weight="semibold"
                block
                style={{ marginTop: tokens.spacingVerticalL }}
              >
                Analyzing Performance...
              </Text>
              <Text
                size={200}
                block
                style={{ marginTop: tokens.spacingVerticalS }}
              >
                This may take up to 30 seconds
              </Text>
            </div>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <AssessmentPanel
        open={showAssessment}
        assessment={assessment}
        onClose={() => setShowAssessment(false)}
      />

      {!configLoading && (hasPredefinedAgent || (!showSetup && currentAgent)) && (
        <div className={styles.mainLayout}>
          <VideoPanel videoRef={videoRef} />
          <ChatPanel
            messages={messages}
            recording={recording}
            connected={connected}
            canAnalyze={messages.length > 0}
            onToggleRecording={toggleRecording}
            onClear={clearMessages}
            onAnalyze={handleAnalyze}
            scenario={activeScenario}
          />
        </div>
      )}
    </div>
  )
}
