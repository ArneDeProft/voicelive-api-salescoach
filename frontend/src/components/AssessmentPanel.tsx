/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    Badge,
    Button,
    Card,
    CardHeader,
    Dialog,
    DialogActions,
    DialogBody,
    DialogSurface,
    DialogTitle,
    Input,
    Label,
    makeStyles,
    ProgressBar,
    Tab,
    TabList,
    TabValue,
    Text,
    tokens,
} from '@fluentui/react-components'
import { useState } from 'react'
import { Assessment } from '../types'

const useStyles = makeStyles({
  dialogBody: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  headerBar: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: tokens.spacingHorizontalM,
  },
  scoreValue: {
    fontSize: '48px',
    lineHeight: 1,
    fontWeight: 700,
  },
  tabs: {
    // Remove margins to let the parent container handle spacing
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalL,
  },
  card: {
    padding: tokens.spacingVerticalL,
    height: 'fit-content',
  },
  tabContent: {
    minHeight: '400px',
  },
  sectionTitle: {
    marginBottom: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalXS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  metric: {
    marginBottom: tokens.spacingVerticalL,
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalS,
  },
  feedbackCard: {
    padding: tokens.spacingVerticalL,
  },
  feedbackSection: {
    marginBottom: tokens.spacingVerticalXL,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `2px solid ${tokens.colorNeutralStroke2}`,
  },
  sectionIcon: {
    fontSize: '24px',
  },
  feedbackGrid: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
  },
  feedbackItem: {
    padding: tokens.spacingVerticalL,
    marginBottom: '0',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    borderLeft: `4px solid ${tokens.colorBrandBackground}`,
    boxShadow: tokens.shadow4,
    transition: 'all 0.2s ease',
    '&:hover': {
      boxShadow: tokens.shadow8,
      transform: 'translateY(-1px)',
    },
  },
  improvementItem: {
    borderLeftColor: tokens.colorPaletteYellowBackground3,
    backgroundColor: tokens.colorPaletteYellowBackground1,
  },
  strengthItem: {
    borderLeftColor: tokens.colorPaletteGreenBackground3,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  feedbackText: {
    lineHeight: 1.6,
    fontSize: '14px',
  },
  noContent: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
    padding: tokens.spacingVerticalL,
  },
  wordGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
  },
})

interface Props {
  open: boolean
  assessment: Assessment | null
  onClose: () => void
}

export function AssessmentPanel({ open, assessment, onClose }: Props) {
  const styles = useStyles()
  const [tab, setTab] = useState<TabValue>('overview')
  const [participantName, setParticipantName] = useState('')

  if (!assessment) return null

  const getScoreColor = (score: number): 'success' | 'warning' | 'danger' => {
    if (score >= 80) return 'success'
    if (score >= 60) return 'warning'
    return 'danger'
  }

  const handlePrint = () => {
    const a = assessment
    const scoreLabel =
      a.ai_assessment?.overall_score != null
        ? a.ai_assessment.overall_score >= 80
          ? 'Great'
          : a.ai_assessment.overall_score >= 60
            ? 'Good'
            : 'Needs Work'
        : ''

    const renderList = (items: string[], emptyMsg: string) =>
      items.length > 0
        ? items.map((item) => `<li>${item}</li>`).join('')
        : `<li><em>${emptyMsg}</em></li>`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Performance Assessment</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 32px; color: #111; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .participant { font-size: 16px; color: #555; margin-bottom: 8px; }
    h2 { font-size: 18px; border-bottom: 2px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
    h3 { font-size: 15px; margin-bottom: 4px; color: #444; }
    .score { font-size: 48px; font-weight: 700; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; background: #e0e0e0; margin-left: 8px; }
    .metric { margin-bottom: 12px; }
    .metric-row { display: flex; justify-content: space-between; }
    progress { width: 100%; height: 8px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 6px; line-height: 1.5; }
    .section { margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Performance Assessment</h1>
  ${participantName ? `<p class="participant">Participant: <strong>${participantName}</strong></p>` : ''}
  ${
    a.ai_assessment
      ? `<div><span class="score">${a.ai_assessment.overall_score}</span><span class="badge">${scoreLabel}</span></div>
         <progress value="${a.ai_assessment.overall_score}" max="100"></progress>`
      : ''
  }

  <h2>Overview</h2>
  <div class="grid">
    ${
      a.ai_assessment
        ? `<div>
            <h3>🎯 AI Sales Assessment</h3>
            <h4>Speaking Tone &amp; Style (${a.ai_assessment.speaking_tone_style.total}/30)</h4>
            <div class="metric">
              <div class="metric-row"><span>Professional Tone</span><span>${a.ai_assessment.speaking_tone_style.professional_tone}/10</span></div>
              <progress value="${a.ai_assessment.speaking_tone_style.professional_tone}" max="10"></progress>
            </div>
            <div class="metric">
              <div class="metric-row"><span>Active Listening</span><span>${a.ai_assessment.speaking_tone_style.active_listening}/10</span></div>
              <progress value="${a.ai_assessment.speaking_tone_style.active_listening}" max="10"></progress>
            </div>
            <div class="metric">
              <div class="metric-row"><span>Engagement Quality</span><span>${a.ai_assessment.speaking_tone_style.engagement_quality}/10</span></div>
              <progress value="${a.ai_assessment.speaking_tone_style.engagement_quality}" max="10"></progress>
            </div>
            <h4>Content Quality (${a.ai_assessment.conversation_content.total}/70)</h4>
            <div class="metric">
              <div class="metric-row"><span>Needs Assessment</span><span>${a.ai_assessment.conversation_content.needs_assessment}/25</span></div>
              <progress value="${a.ai_assessment.conversation_content.needs_assessment}" max="25"></progress>
            </div>
            <div class="metric">
              <div class="metric-row"><span>Value Proposition</span><span>${a.ai_assessment.conversation_content.value_proposition}/25</span></div>
              <progress value="${a.ai_assessment.conversation_content.value_proposition}" max="25"></progress>
            </div>
            <div class="metric">
              <div class="metric-row"><span>Objection Handling</span><span>${a.ai_assessment.conversation_content.objection_handling}/20</span></div>
              <progress value="${a.ai_assessment.conversation_content.objection_handling}" max="20"></progress>
            </div>
           </div>`
        : ''
    }
    ${
      a.pronunciation_assessment
        ? `<div>
            <h3>🗣️ Pronunciation Assessment</h3>
            <div class="metric">
              <div class="metric-row"><span>Accuracy</span><span>${a.pronunciation_assessment.accuracy_score.toFixed(1)}</span></div>
              <progress value="${a.pronunciation_assessment.accuracy_score}" max="100"></progress>
            </div>
            <div class="metric">
              <div class="metric-row"><span>Fluency</span><span>${a.pronunciation_assessment.fluency_score.toFixed(1)}</span></div>
              <progress value="${a.pronunciation_assessment.fluency_score}" max="100"></progress>
            </div>
            ${
              a.pronunciation_assessment.words && a.pronunciation_assessment.words.length > 0
                ? `<h4>Word-Level Analysis</h4><p>${a.pronunciation_assessment.words.slice(0, 12).map((w) => `${w.word} (${w.accuracy}%)`).join(', ')}</p>`
                : ''
            }
           </div>`
        : ''
    }
  </div>

  ${
    a.ai_assessment
      ? `<h2>Recommendations</h2>
         <div class="section">
           <h3>Strengths</h3>
           <ul>${renderList(a.ai_assessment.strengths, 'No specific strengths identified in this session.')}</ul>
         </div>
         <div class="section">
           <h3>Areas for Improvement</h3>
           <ul>${renderList(a.ai_assessment.improvements, 'No specific areas for improvement identified.')}</ul>
         </div>`
      : ''
  }

  <h2>Evaluator Notes</h2>
  <p>${a.ai_assessment?.specific_feedback || 'No evaluator notes available.'}</p>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      win.print()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface
        style={{ maxWidth: '1200px', width: '95vw', maxHeight: '90vh' }}
      >
        <DialogTitle>Performance Assessment</DialogTitle>
        <DialogBody className={styles.dialogBody}>
          {/* Participant Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
            <Label htmlFor="participant-name">Participant name</Label>
            <Input
              id="participant-name"
              placeholder="Enter name for printed report"
              value={participantName}
              onChange={(_, data) => setParticipantName(data.value)}
              style={{ flex: 1 }}
            />
          </div>
          {/* Overall Score Section */}
          {assessment.ai_assessment && (
            <div className={styles.headerBar}>
              <Text size={600} weight="semibold">
                Overall Score
              </Text>
              <div className={styles.scoreRow}>
                <span className={styles.scoreValue}>
                  {assessment.ai_assessment.overall_score}
                </span>
                <Badge
                  color={getScoreColor(assessment.ai_assessment.overall_score)}
                  appearance="filled"
                  size="large"
                >
                  {assessment.ai_assessment.overall_score >= 80
                    ? 'Great'
                    : assessment.ai_assessment.overall_score >= 60
                      ? 'Good'
                      : 'Needs Work'}
                </Badge>
              </div>
              <ProgressBar
                value={assessment.ai_assessment.overall_score / 100}
                thickness="large"
              />
            </div>
          )}

          {/* Tabs Section */}
          <TabList
            className={styles.tabs}
            appearance="subtle"
            size="large"
            selectedValue={tab}
            onTabSelect={(_, data) => setTab(data.value)}
          >
            <Tab value="overview">Overview</Tab>
            <Tab value="recommendations">Recommendations</Tab>
            <Tab value="notes">Evaluator Notes</Tab>
          </TabList>

          {/* Content Section */}
          {tab === 'overview' && (
            <div className={styles.grid}>
              {assessment.ai_assessment && (
                <Card className={styles.card}>
                  <CardHeader
                    header={
                      <Text size={500} weight="semibold">
                        🎯 AI Sales Assessment
                      </Text>
                    }
                  />

                  <div className={styles.sectionTitle}>
                    <Text size={400} weight="semibold">
                      Speaking Tone & Style (
                      {assessment.ai_assessment.speaking_tone_style.total}/30)
                    </Text>
                  </div>

                  <div className={styles.metric}>
                    <div className={styles.metricHeader}>
                      <Text size={300}>Professional Tone</Text>
                      <Badge appearance="tint">
                        {
                          assessment.ai_assessment.speaking_tone_style
                            .professional_tone
                        }
                        /10
                      </Badge>
                    </div>
                    <ProgressBar
                      value={
                        assessment.ai_assessment.speaking_tone_style
                          .professional_tone / 10
                      }
                    />
                  </div>

                  <div className={styles.metric}>
                    <div className={styles.metricHeader}>
                      <Text size={300}>Active Listening</Text>
                      <Badge appearance="tint">
                        {
                          assessment.ai_assessment.speaking_tone_style
                            .active_listening
                        }
                        /10
                      </Badge>
                    </div>
                    <ProgressBar
                      value={
                        assessment.ai_assessment.speaking_tone_style
                          .active_listening / 10
                      }
                    />
                  </div>

                  <div className={styles.metric}>
                    <div className={styles.metricHeader}>
                      <Text size={300}>Engagement Quality</Text>
                      <Badge appearance="tint">
                        {
                          assessment.ai_assessment.speaking_tone_style
                            .engagement_quality
                        }
                        /10
                      </Badge>
                    </div>
                    <ProgressBar
                      value={
                        assessment.ai_assessment.speaking_tone_style
                          .engagement_quality / 10
                      }
                    />
                  </div>

                  <div className={styles.sectionTitle}>
                    <Text size={400} weight="semibold">
                      Content Quality (
                      {assessment.ai_assessment.conversation_content.total}/70)
                    </Text>
                  </div>

                  <div className={styles.metric}>
                    <div className={styles.metricHeader}>
                      <Text size={300}>Needs Assessment</Text>
                      <Badge appearance="tint">
                        {
                          assessment.ai_assessment.conversation_content
                            .needs_assessment
                        }
                        /25
                      </Badge>
                    </div>
                    <ProgressBar
                      value={
                        assessment.ai_assessment.conversation_content
                          .needs_assessment / 25
                      }
                    />
                  </div>

                  <div className={styles.metric}>
                    <div className={styles.metricHeader}>
                      <Text size={300}>Value Proposition</Text>
                      <Badge appearance="tint">
                        {
                          assessment.ai_assessment.conversation_content
                            .value_proposition
                        }
                        /25
                      </Badge>
                    </div>
                    <ProgressBar
                      value={
                        assessment.ai_assessment.conversation_content
                          .value_proposition / 25
                      }
                    />
                  </div>

                  <div className={styles.metric}>
                    <div className={styles.metricHeader}>
                      <Text size={300}>Objection Handling</Text>
                      <Badge appearance="tint">
                        {
                          assessment.ai_assessment.conversation_content
                            .objection_handling
                        }
                        /20
                      </Badge>
                    </div>
                    <ProgressBar
                      value={
                        assessment.ai_assessment.conversation_content
                          .objection_handling / 20
                      }
                    />
                  </div>
                </Card>
              )}

              {assessment.pronunciation_assessment && (
                <Card className={styles.card}>
                  <CardHeader
                    header={
                      <Text size={500} weight="semibold">
                        🗣️ Pronunciation Assessment
                      </Text>
                    }
                  />

                  <div className={styles.metric}>
                    <div className={styles.metricHeader}>
                      <Text size={300}>Accuracy</Text>
                      <Badge
                        color={getScoreColor(
                          assessment.pronunciation_assessment.accuracy_score
                        )}
                        appearance="filled"
                      >
                        {assessment.pronunciation_assessment.accuracy_score.toFixed(
                          1
                        )}
                      </Badge>
                    </div>
                    <ProgressBar
                      value={
                        assessment.pronunciation_assessment.accuracy_score / 100
                      }
                    />
                  </div>

                  <div className={styles.metric}>
                    <div className={styles.metricHeader}>
                      <Text size={300}>Fluency</Text>
                      <Badge
                        color={getScoreColor(
                          assessment.pronunciation_assessment.fluency_score
                        )}
                        appearance="filled"
                      >
                        {assessment.pronunciation_assessment.fluency_score.toFixed(
                          1
                        )}
                      </Badge>
                    </div>
                    <ProgressBar
                      value={
                        assessment.pronunciation_assessment.fluency_score / 100
                      }
                    />
                  </div>

                  {assessment.pronunciation_assessment.words && (
                    <>
                      <div className={styles.sectionTitle}>
                        <Text size={400} weight="semibold">
                          Word-Level Analysis
                        </Text>
                      </div>
                      <div className={styles.wordGrid}>
                        {assessment.pronunciation_assessment.words
                          .slice(0, 12)
                          .map((word, i) => (
                            <Badge
                              key={i}
                              color={getScoreColor(word.accuracy)}
                              appearance="tint"
                              size="small"
                            >
                              {word.word} ({word.accuracy}%)
                            </Badge>
                          ))}
                      </div>
                    </>
                  )}
                </Card>
              )}
            </div>
          )}

          {tab === 'recommendations' && assessment.ai_assessment && (
            <Card className={styles.feedbackCard}>
              <CardHeader
                header={
                  <Text size={500} weight="semibold">
                    💡 Improvement Recommendations
                  </Text>
                }
              />

              <div className={styles.feedbackSection}>
                <div className={styles.sectionHeader}>
                  <Text size={500} weight="semibold">
                    Strengths
                  </Text>
                </div>
                {assessment.ai_assessment.strengths.length > 0 ? (
                  <div className={styles.feedbackGrid}>
                    {assessment.ai_assessment.strengths.map((strength, i) => (
                      <div
                        key={i}
                        className={`${styles.feedbackItem} ${styles.strengthItem}`}
                      >
                        <Text className={styles.feedbackText}>{strength}</Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noContent}>
                    <Text>
                      No specific strengths identified in this session.
                    </Text>
                  </div>
                )}
              </div>

              <div className={styles.feedbackSection}>
                <div className={styles.sectionHeader}>
                  <Text size={500} weight="semibold">
                    Areas for Improvement
                  </Text>
                </div>
                {assessment.ai_assessment.improvements.length > 0 ? (
                  <div className={styles.feedbackGrid}>
                    {assessment.ai_assessment.improvements.map(
                      (improvement, i) => (
                        <div
                          key={i}
                          className={`${styles.feedbackItem} ${styles.improvementItem}`}
                        >
                          <Text className={styles.feedbackText}>
                            {improvement}
                          </Text>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className={styles.noContent}>
                    <Text>No specific areas for improvement identified.</Text>
                  </div>
                )}
              </div>
            </Card>
          )}

          {tab === 'notes' && (
            <Card className={styles.card}>
              <CardHeader
                header={
                  <Text size={500} weight="semibold">
                    📝 Evaluator Notes
                  </Text>
                }
              />
              <Text size={300} style={{ lineHeight: 1.6 }}>
                {assessment.ai_assessment?.specific_feedback ||
                  'No evaluator notes available.'}
              </Text>
            </Card>
          )}
        </DialogBody>
        <DialogActions>
          <Button appearance="secondary" onClick={handlePrint}>
            🖨️ Print
          </Button>
          <Button appearance="primary" onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  )
}
