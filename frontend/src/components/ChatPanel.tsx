/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  Button,
  Card,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ChartMultipleRegular,
  MicOffRegular,
  MicRegular
} from '@fluentui/react-icons'
import { Message, Scenario } from '../types'

const useStyles = makeStyles({
  card: {
    width: '100%',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: tokens.spacingVerticalS,
    maxHeight: '520px',
  },
  header: {
    marginBottom: tokens.spacingVerticalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  headerDescription: {
    color: tokens.colorNeutralForeground3,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: '260px',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
  placeholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground3,
  },
  message: {
    padding: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
  },
  userMessage: {
    backgroundColor: tokens.colorBrandBackground2,
    marginLeft: '20%',
  },
  assistantMessage: {
    backgroundColor: tokens.colorNeutralBackground2,
    marginRight: '20%',
  },
  controls: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
})

interface Props {
  messages: Message[]
  recording: boolean
  connected: boolean
  canAnalyze: boolean
  avatarReady: boolean
  onToggleRecording: () => void
  onClear: () => void
  onAnalyze: () => void
  scenario?: Scenario | null
}

export function ChatPanel({
  messages,
  recording,
  connected: _connected,
  canAnalyze,
  avatarReady,
  onToggleRecording,
  onClear,
  onAnalyze,
  scenario,
}: Props) {
  const styles = useStyles()

  return (
    <Card className={styles.card}>
      {scenario && (
        <div className={styles.header}>
          <Text size={500} weight="semibold" block>
            {scenario.name}
          </Text>
          <Text size={300} block className={styles.headerDescription}>
            {scenario.description}
          </Text>
        </div>
      )}

      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.placeholder}>
            <Text size={300} weight="semibold">
              Get started
            </Text>
            <Text size={200}>
              Click "Start Training" to begin the conversation.
            </Text>
          </div>
        ) : (
          <>
            {messages
              .slice()
              .reverse()
              .map(msg => (
                <div
                  key={msg.id}
                  className={`${styles.message} ${
                    msg.role === 'user'
                      ? styles.userMessage
                      : styles.assistantMessage
                  }`}
                >
                  <Text size={300}>{msg.content}</Text>
                </div>
              ))}
          </>
        )}
      </div>

      <div className={styles.controls}>
        <Button
          appearance={recording ? 'primary' : 'secondary'}
          icon={recording ? <MicOffRegular /> : <MicRegular />}
          onClick={onToggleRecording}
          disabled={!avatarReady}
        >
          {recording ? 'Stop Training' : 'Start Training'}
        </Button>

        {/* <Button appearance="subtle" icon={<DeleteRegular />} onClick={onClear}>
          Clear
        </Button> */}

        <Button
          appearance="primary"
          icon={<ChartMultipleRegular />}
          onClick={onAnalyze}
          disabled={!canAnalyze}
        >
          Analyze Performance
        </Button>
      </div>
    </Card>
  )
}
