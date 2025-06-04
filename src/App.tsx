import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Trash2, Copy, Download } from 'lucide-react'
import { Button } from './components/ui/button'
import { Card, CardContent } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { toast } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from './types/speech'

interface Transcription {
  id: string
  text: string
  timestamp: Date
  confidence: number
}

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const [isSupported, setIsSupported] = useState(true)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionConstructor) {
      setIsSupported(false)
      toast.error('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognitionConstructor() as SpeechRecognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        const newTranscription: Transcription = {
          id: Date.now().toString(),
          text: finalTranscript.trim(),
          timestamp: new Date(),
          confidence: event.results[event.results.length - 1][0].confidence || 0.8
        }
        setTranscriptions(prev => [...prev, newTranscription])
        setCurrentTranscript('')
      } else {
        setCurrentTranscript(interimTranscript)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied')
      }
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)
      
      monitorAudioLevel()

      mediaRecorderRef.current = new MediaRecorder(stream)
      mediaRecorderRef.current.start()

      if (recognitionRef.current) {
        recognitionRef.current.start()
      }

      setIsRecording(true)
      toast.success('Recording started')
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Failed to start recording')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    setIsRecording(false)
    setAudioLevel(0)
    setCurrentTranscript('')
    toast.success('Recording stopped')
  }

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    
    const updateLevel = () => {
      analyserRef.current!.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
      setAudioLevel(average / 255)
      animationFrameRef.current = requestAnimationFrame(updateLevel)
    }

    updateLevel()
  }

  const clearTranscriptions = () => {
    setTranscriptions([])
    toast.success('Transcriptions cleared')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const downloadTranscriptions = () => {
    const content = transcriptions.map(t => 
      `[${t.timestamp.toLocaleTimeString()}] ${t.text}`
    ).join('\n\n')
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcriptions-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Transcriptions downloaded')
  }

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-4">
              <MicOff size={48} className="mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Browser Not Supported</h2>
            <p className="text-gray-600">
              Your browser doesn't support speech recognition. Please try Chrome, Edge, or Safari.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2"
          >
            Voice Transcriber
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-600"
          >
            Record your voice and get instant transcriptions
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <Card className="mb-8 border-0 shadow-xl bg-white/70 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <motion.div
                    animate={{ 
                      scale: isRecording ? [1, 1.1, 1] : 1,
                      boxShadow: isRecording 
                        ? ['0 0 0 0 rgba(59, 130, 246, 0.7)', '0 0 0 20px rgba(59, 130, 246, 0)', '0 0 0 0 rgba(59, 130, 246, 0)']
                        : '0 0 0 0 rgba(59, 130, 246, 0)'
                    }}
                    transition={{ 
                      duration: isRecording ? 1.5 : 0.3,
                      repeat: isRecording ? Infinity : 0
                    }}
                    className="rounded-full"
                  >
                    <Button
                      onClick={isRecording ? stopRecording : startRecording}
                      size="lg"
                      className={`w-20 h-20 rounded-full transition-all duration-300 shadow-lg ${
                        isRecording 
                          ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200' 
                          : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-200'
                      }`}
                    >
                      {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
                    </Button>
                  </motion.div>
                  
                  {isRecording && (
                    <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                      <div className="flex space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <motion.div
                            key={i}
                            animate={{ 
                              height: audioLevel > (i * 0.2) ? `${Math.max(4, audioLevel * 20)}px` : '4px',
                              backgroundColor: audioLevel > (i * 0.2) ? '#3b82f6' : '#d1d5db'
                            }}
                            className="w-1 bg-gray-300 rounded-full"
                            style={{ height: '4px' }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <Badge variant={isRecording ? "destructive" : "secondary"} className="mb-2">
                    {isRecording ? 'Recording...' : 'Ready to record'}
                  </Badge>
                  <p className="text-sm text-gray-600">
                    {isRecording ? 'Speak clearly into your microphone' : 'Click the microphone to start recording'}
                  </p>
                </div>

                <AnimatePresence>
                  {currentTranscript && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="w-full max-w-2xl"
                    >
                      <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
                        <p className="text-blue-800 italic">
                          {currentTranscript}
                          <span className="inline-block w-2 h-5 bg-blue-600 ml-1 animate-pulse"></span>
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {transcriptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">Transcriptions</h2>
              <div className="flex space-x-2">
                <Button
                  onClick={downloadTranscriptions}
                  variant="outline"
                  size="sm"
                  className="bg-white/70 backdrop-blur-sm"
                >
                  <Download size={16} className="mr-2" />
                  Download
                </Button>
                <Button
                  onClick={clearTranscriptions}
                  variant="outline"
                  size="sm"
                  className="bg-white/70 backdrop-blur-sm text-red-600 hover:text-red-700"
                >
                  <Trash2 size={16} className="mr-2" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {transcriptions.map((transcription, index) => (
                <motion.div
                  key={transcription.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {transcription.timestamp.toLocaleTimeString()}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(transcription.confidence * 100)}% confidence
                          </Badge>
                        </div>
                        <Button
                          onClick={() => copyToClipboard(transcription.text)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Copy size={14} />
                        </Button>
                      </div>
                      <p className="text-gray-800 leading-relaxed">{transcription.text}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {transcriptions.length === 0 && !isRecording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center py-16"
          >
            <div className="text-gray-400 mb-4">
              <Mic size={64} className="mx-auto" />
            </div>
            <h3 className="text-xl font-medium text-gray-600 mb-2">No recordings yet</h3>
            <p className="text-gray-500">Start recording to see your transcriptions here</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default App
