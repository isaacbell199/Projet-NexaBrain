'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  Wand2,
  Square,
  X,
  Zap,
  AlertCircle,
  GripVertical,
  RefreshCw,
  CheckCircle,
  Play,
  ArrowRight,
  BookOpen,
  Compass,
  ChevronDown,
  User,
  Heart,
  Wind,
  Eye,
  Brain
} from 'lucide-react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { toast } from 'sonner'
import { useStore } from '@/lib/store'
import {
  generateText,
  stopGeneration,
  onGenerationChunk,
  isTauri
} from '@/lib/tauri-api'

// ============================================================================
// Types
// ============================================================================

type TabType = 'story' | 'action'

interface CharacterData {
  id: string
  name: string
  description: string
  isFromWorld?: boolean
}

interface StorySituation {
  id: string
  text: string
  generatedParagraph: string
  status: 'pending' | 'generating' | 'done' | 'error'
}

// ============================================================================
// Action Tab - Visceral Narration Buttons
// ============================================================================

// Action button specific parameter modifiers (applied on top of user preset)
const ACTION_BUTTON_MODIFIERS = {
  'physical-impact': {
    tempModifier: 0.08,      // Slightly more creative for visceral descriptions
    minPModifier: 0.02,      // Slightly lower minP for variety
    description: 'Raw physical contact, fluids, sounds'
  },
  'internal-sensations': {
    tempModifier: 0.05,      // Moderate creativity for sensory details
    minPModifier: 0.01,      
    description: 'Internal body sensations, emotions in the body'
  },
  'expression-cry': {
    tempModifier: 0.0,       // Neutral - dialogue needs balance
    minPModifier: 0.0,       
    description: 'Vocal expressions, facial movements'
  },
  'scene-atmosphere': {
    tempModifier: -0.03,     // Slightly more coherent for descriptions
    minPModifier: 0.01,      // Slightly higher for consistency
    description: 'Environment, lighting, smells, sounds'
  },
  'secret-thought': {
    tempModifier: -0.08,     // More coherent for logical thoughts
    minPModifier: 0.03,      // Higher minP for consistency
    description: 'Inner monologue, hidden thoughts'
  },
}

// Context-based additional modifiers (applied when AUTO is ON)
const CONTEXT_MODIFIERS = {
  violent: { tempModifier: 0.05, minPModifier: -0.01 },
  romantic: { tempModifier: 0.08, minPModifier: -0.02 },
  neutral: { tempModifier: 0, minPModifier: 0 }
}

const ACTION_BUTTONS = [
  {
    id: 'physical-impact',
    name: 'PHYSICAL IMPACT',
    focus: 'Raw contact, matter, fluids.',
    instruction: 'Describe the shock of bodies or objects. Include blood splatter, sweat, saliva, flesh tearing, or the softness of a caress. Detail the sounds (cracking, rustling, moaning).',
    color: 'rose'
  },
  {
    id: 'internal-sensations',
    name: 'INTERNAL SENSATIONS',
    focus: 'The character\'s biological system.',
    instruction: 'Describe what cannot be seen from outside: vibrations in bones, burning of wounds, pounding heart, heat rising (blushing), adrenaline, dizziness, pleasures, joys, fears.',
    color: 'amber'
  },
  {
    id: 'expression-cry',
    name: 'EXPRESSION / CRY',
    focus: 'Vocal output and facial expression.',
    instruction: 'Generate spoken words, cries, groans, or murmurs. Describe precisely the expression of eyes, facial contractions, body movements.',
    color: 'sky'
  },
  {
    id: 'scene-atmosphere',
    name: 'SCENE & ATMOSPHERE',
    focus: 'Environmental immersion.',
    instruction: 'Describe characters, their positions, facial and physical expressions (pleasures, joys, fears), smells, sounds, noises (metallic, perfume, dust), light, wind, heat, or oppressive silence.',
    color: 'emerald'
  },
  {
    id: 'secret-thought',
    name: 'SECRET THOUGHT',
    focus: 'Inner monologue (the unspoken).',
    instruction: 'Reveal what the character truly thinks, their doubts, hidden desires, or strategies, but keeps strictly to themselves.',
    color: 'violet'
  },
]

// ============================================================================
// Component
// ============================================================================

interface AIAssistantProps {
  editorContent: string
  onStreamChunk: (chunk: string) => void
  isGenerating: boolean
  onGenerationStart: () => void
  onGenerationEnd: () => void
  creativeCategory?: string
  creativeTone?: string
  creativeStyle?: string
  creativeTheme?: string
  projectCharacters?: { id: string; name: string; description: string }[]
  projectLore?: string
}

export function AIAssistant({
  editorContent,
  onStreamChunk,
  isGenerating,
  onGenerationStart,
  onGenerationEnd,
  creativeCategory,
  creativeTone,
  creativeStyle,
  creativeTheme,
  projectCharacters = [],
  projectLore,
}: AIAssistantProps) {
  const {
    isModelLoaded,
    temperature,
    inputLanguage,
    outputLanguage,
    // Generation Preset Parameters
    topP,
    topK,
    minP,
    repeatPenalty,
    frequencyPenalty,
    presencePenalty,
    maxTokens,
  } = useStore()

  // Tab state - Default to 'action'
  const [activeTab, setActiveTab] = useState<TabType>('action')

  // ============ SHARED STATE ============
  const [characters, setCharacters] = useState<CharacterData[]>([])
  const currentGeneratingIndexRef = useRef<number>(-1)

  // ============ STORY TAB STATE ============
  const [storyInputText, setStoryInputText] = useState('')
  const [storySituations, setStorySituations] = useState<StorySituation[]>([])
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState<number>(-1)
  const [storyMode, setStoryMode] = useState<'input' | 'situations' | 'generating'>('input')

  // ============ ACTION TAB STATE ============
  const [actionSelectedActor, setActionSelectedActor] = useState<string>('narrator')
  const [actionDescription, setActionDescription] = useState('')
  const [actionPhraseCount, setActionPhraseCount] = useState(2)
  const [actionAutoMode, setActionAutoMode] = useState(true)

  // ============ STORY RAIL STATE ============
  const [storyRailContent, setStoryRailContent] = useState<string>('')
  const [showStoryRail, setShowStoryRail] = useState(false)

  // Load characters from project, World Studio, and Database
  useEffect(() => {
    async function loadAllCharacters() {
      const initialChars: CharacterData[] = projectCharacters.map(c => ({
        ...c,
        isFromWorld: false
      }))

      // Load from World Studio (localStorage)
      try {
        const savedWorld = localStorage.getItem('world_studio_current')
        if (savedWorld) {
          const worldData = JSON.parse(savedWorld)
          if (worldData.characters && Array.isArray(worldData.characters)) {
            const worldChars = worldData.characters
              .filter((c: { title: string }) => c.title?.trim())
              .map((c: { id: string; title: string; description: string }) => ({
                id: c.id,
                name: c.title,
                description: c.description || '',
                isFromWorld: true
              }))
            initialChars.push(...worldChars)
          }
        }
      } catch (e) {
        console.error('Failed to load world data:', e)
      }

      // 100% Desktop - All data loaded from Tauri backend via localStorage
      // Characters are stored in localStorage by World Studio

      // Filter out any character named exactly "Narrator" to avoid duplicates
      const filteredChars = initialChars.filter(c => c.name !== 'Narrator')
      setCharacters(filteredChars)
    }

    loadAllCharacters()
  }, [projectCharacters])

  // Load Story Rail content from localStorage on mount
  useEffect(() => {
    try {
      const savedRail = localStorage.getItem('story_rail_content')
      if (savedRail) {
        setStoryRailContent(savedRail)
      }
    } catch (e) {
      console.error('Failed to load story rail:', e)
    }
  }, [])

  // Save Story Rail content
  const handleSaveStoryRail = useCallback(() => {
    try {
      localStorage.setItem('story_rail_content', storyRailContent)
      setShowStoryRail(false)
      toast.success('Story Rail saved!')
    } catch (e) {
      console.error('Failed to save story rail:', e)
      toast.error('Failed to save Story Rail')
    }
  }, [storyRailContent])

  // Helper: Build creative settings prompt suffix
  const buildCreativePrompt = useCallback(() => {
    let prompt = ''
    if (creativeCategory) prompt += `Genre: ${creativeCategory}\n`
    if (creativeTone) prompt += `Tone: ${creativeTone}\n`
    if (creativeStyle) prompt += `Writing Style: ${creativeStyle}\n`
    if (creativeTheme) prompt += `Theme: ${creativeTheme}\n`
    if (projectLore) prompt += `World Lore: ${projectLore}\n`
    return prompt
  }, [creativeCategory, creativeTone, creativeStyle, creativeTheme, projectLore])

  // Stop generation
  const handleStopGeneration = useCallback(() => {
    stopGeneration()
    onGenerationEnd()
    setCurrentGeneratingIndex(-1)
    toast.info('Generation stopped')
  }, [onGenerationEnd])

  // ============ STORY FUNCTIONS ============

  const parseSituations = useCallback(() => {
    const lines = storyInputText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    if (lines.length === 0) {
      toast.error('Please enter at least one situation')
      return
    }

    const situations: StorySituation[] = lines.map((text, index) => ({
      id: `sit-${Date.now()}-${index}`,
      text,
      generatedParagraph: '',
      status: 'pending'
    }))

    setStorySituations(situations)
    setStoryMode('situations')
    toast.success(`${situations.length} situations ready!`)
  }, [storyInputText])

  const handleReorderSituations = useCallback((newOrder: StorySituation[]) => {
    setStorySituations(newOrder)
  }, [])

  const removeSituation = useCallback((id: string) => {
    setStorySituations(prev => prev.filter(s => s.id !== id))
  }, [])

  const generateStory = async () => {
    if (!isModelLoaded) {
      toast.error('Please load a model first')
      return
    }

    if (storySituations.length === 0) {
      toast.error('No situations to generate')
      return
    }

    setStoryMode('generating')
    onGenerationStart()

    try {
      const resetSituations = storySituations.map(s => ({
        ...s,
        status: 'pending' as const,
        generatedParagraph: ''
      }))
      setStorySituations(resetSituations)

      let generatedSoFar = ''

      for (let i = 0; i < resetSituations.length; i++) {
        if (!isGenerating && i > 0) break

        setCurrentGeneratingIndex(i)
        currentGeneratingIndexRef.current = i
        
        setStorySituations(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: 'generating' } : s
        ))

        const situation = resetSituations[i]
        const creativePrompt = buildCreativePrompt()
        const previousContext = generatedSoFar 
          ? `\n\nPREVIOUSLY IN THE STORY:\n${generatedSoFar.slice(-1500)}\n` 
          : ''

        // Build Story Rail section if content exists
        const storyRailSection = storyRailContent.trim() 
          ? `\n[FRAMEWORK INSTRUCTIONS - STORY RAIL]\nHere is the complete story path: "${storyRailContent}"\nYou must use this text ONLY as a reference for coherence, not as content to copy.\n` 
          : ''

        const prompt = `${creativePrompt}${storyRailSection}
You are writing paragraph ${i + 1} of ${resetSituations.length} in a continuous story.

SITUATION TO WRITE: ${situation.text}
${previousContext}
RULES:
- Write ONE paragraph (2-4 sentences) for this specific situation
- If this is not the first paragraph, connect smoothly to the previous events
- Maintain consistent tone, style, and narrative voice
- Be vivid and engaging

[CRITICAL BLOCKING CONSTRAINT]
Absolute prohibition on anticipating the scenario continuation.
Never skip steps, never summarize, never anticipate.
Focus exclusively on the current action requested.

Write the paragraph now:`

        if (isTauri()) {
          let paragraphContent = ''

          const unsubscribe = await onGenerationChunk((chunk) => {
            if (chunk.done) {
              setStorySituations(prev => prev.map((s, idx) => 
                idx === i ? { ...s, status: 'done', generatedParagraph: paragraphContent } : s
              ))
              
              if (i === 0) {
                onStreamChunk(paragraphContent)
              } else {
                onStreamChunk('\n\n' + paragraphContent)
              }
              
              generatedSoFar += paragraphContent + '\n\n'
            } else {
              paragraphContent += chunk.content
            }
          })

          await generateText({
            mode: 'story',
            text: prompt,
            context: editorContent.slice(-1000) + generatedSoFar.slice(-1000),
            temperature,
            maxTokens,
            inputLanguage,
            language: outputLanguage,
            selectedTone: creativeTone,
            customStyleName: creativeStyle,
            customGenreName: creativeCategory,
            customStyleInstruction: creativeTheme,
            // Generation Preset Parameters (from selected preset)
            topP,
            topK,
            minP,
            repeatPenalty,
            frequencyPenalty,
            presencePenalty,
          })

          setTimeout(() => unsubscribe(), 30000)
          await new Promise(r => setTimeout(r, 300))
        } else {
          await new Promise(r => setTimeout(r, 800))
          const demoParagraph = `[Para ${i + 1}] ${situation.text}... The narrative unfolds with vivid details and engaging prose.`
          
          setStorySituations(prev => prev.map((s, idx) => 
            idx === i ? { ...s, status: 'done', generatedParagraph: demoParagraph } : s
          ))
          
          if (i === 0) {
            onStreamChunk(demoParagraph)
          } else {
            onStreamChunk('\n\n' + demoParagraph)
          }
          
          generatedSoFar += demoParagraph + '\n\n'
        }
      }

      setCurrentGeneratingIndex(-1)
      currentGeneratingIndexRef.current = -1
      onGenerationEnd()
      toast.success('Story completed!')
      
    } catch (error) {
      console.error('Story error:', error)
      onGenerationEnd()
      const failedIndex = currentGeneratingIndexRef.current
      setCurrentGeneratingIndex(-1)
      currentGeneratingIndexRef.current = -1
      
      if (failedIndex >= 0) {
        setStorySituations(prev => prev.map((s, idx) => 
          idx === failedIndex ? { ...s, status: 'error' } : s
        ))
      }
      
      toast.error('Generation failed')
    }
  }

  const regenerateParagraph = async (index: number) => {
    if (!isModelLoaded || isGenerating) return

    const situation = storySituations[index]
    if (!situation) return

    setCurrentGeneratingIndex(index)
    onGenerationStart()

    setStorySituations(prev => prev.map((s, idx) => 
      idx === index ? { ...s, status: 'generating', generatedParagraph: '' } : s
    ))

    try {
      const previousParagraphs = storySituations
        .slice(0, index)
        .filter(s => s.status === 'done')
        .map(s => s.generatedParagraph)
        .join('\n\n')

      const creativePrompt = buildCreativePrompt()
      
      const prompt = `${creativePrompt}
You are rewriting paragraph ${index + 1} of a story.

SITUATION TO WRITE: ${situation.text}
${previousParagraphs ? `\nPREVIOUS CONTEXT:\n${previousParagraphs.slice(-1000)}\n` : ''}
RULES:
- Write ONE paragraph (2-4 sentences) for this specific situation
- Connect smoothly to any previous context
- Maintain consistent tone and style
- Be vivid and engaging

Write the paragraph now:`

      let paragraphContent = ''

      if (isTauri()) {
        const unsubscribe = await onGenerationChunk((chunk) => {
          if (chunk.done) {
            setStorySituations(prev => prev.map((s, idx) => 
              idx === index ? { ...s, status: 'done', generatedParagraph: paragraphContent } : s
            ))
            setCurrentGeneratingIndex(-1)
            onGenerationEnd()
            toast.success('Paragraph regenerated!')
          } else {
            paragraphContent += chunk.content
          }
        })

        await generateText({
          mode: 'story',
          text: prompt,
          context: editorContent.slice(-1000),
          temperature,
          maxTokens,
          inputLanguage,
          language: outputLanguage,
          selectedTone: creativeTone,
          customStyleName: creativeStyle,
          customGenreName: creativeCategory,
          customStyleInstruction: creativeTheme,
          // Generation Preset Parameters (from selected preset)
          topP,
          topK,
          minP,
          repeatPenalty,
          frequencyPenalty,
          presencePenalty,
        })

        setTimeout(() => unsubscribe(), 30000)
      } else {
        await new Promise(r => setTimeout(r, 800))
        const demoParagraph = `[Regenerated] ${situation.text}... Fresh narrative with new perspectives.`
        
        setStorySituations(prev => prev.map((s, idx) => 
          idx === index ? { ...s, status: 'done', generatedParagraph: demoParagraph } : s
        ))
        setCurrentGeneratingIndex(-1)
        onGenerationEnd()
        toast.success('Paragraph regenerated! (Demo)')
      }
    } catch (error) {
      console.error('Regenerate error:', error)
      setStorySituations(prev => prev.map((s, idx) => 
        idx === index ? { ...s, status: 'error' } : s
      ))
      setCurrentGeneratingIndex(-1)
      onGenerationEnd()
      toast.error('Regeneration failed')
    }
  }

  const insertStoryToEditor = () => {
    const fullStory = storySituations
      .filter(s => s.status === 'done')
      .map(s => s.generatedParagraph)
      .join('\n\n')
    
    if (fullStory) {
      onStreamChunk('\n\n' + fullStory)
      toast.success('Story inserted!')
    }
  }

  const resetStory = () => {
    setStoryMode('input')
    setStorySituations([])
    setCurrentGeneratingIndex(-1)
  }

  // ============ ACTION TAB FUNCTIONS ============

  const generateActionContent = async (actionButtonId: string) => {
    if (!isModelLoaded) {
      toast.error('Please load a model first')
      return
    }

    if (!actionDescription.trim()) {
      toast.error('Please enter a description')
      return
    }

    const actionButton = ACTION_BUTTONS.find(b => b.id === actionButtonId)
    if (!actionButton) return

    const actorName = actionSelectedActor === 'narrator' 
      ? 'Narrator' 
      : characters.find(c => c.id === actionSelectedActor)?.name || 'Narrator'

    const detectContext = () => {
      const text = actionDescription.toLowerCase()
      const violentKeywords = ['frappe', 'coup', 'bless', 'sang', 'mort', 'combat', 'attaque', 'déchire', 'lame', 'poing', 'tuer', 'battle', 'hit', 'cut', 'blood', 'kill', 'fight', 'punch', 'slash']
      const romanticKeywords = ['caresse', 'embrasse', 'amour', 'désir', 'lèvres', 'tendresse', 'doucement', 'touch', 'love', 'kiss', 'caress', 'embrace', 'gentle']
      
      const hasViolent = violentKeywords.some(k => text.includes(k))
      const hasRomantic = romanticKeywords.some(k => text.includes(k))
      
      if (hasViolent && !hasRomantic) return 'violent'
      if (hasRomantic && !hasViolent) return 'romantic'
      return 'neutral'
    }

    const contextType = actionAutoMode ? detectContext() : 'neutral'

    // Calculate intelligent parameters based on button type + context
    const buttonModifier = ACTION_BUTTON_MODIFIERS[actionButtonId as keyof typeof ACTION_BUTTON_MODIFIERS] 
      || { tempModifier: 0, minPModifier: 0 }
    const contextModifier = actionAutoMode 
      ? (CONTEXT_MODIFIERS[contextType as keyof typeof CONTEXT_MODIFIERS] || { tempModifier: 0, minPModifier: 0 })
      : { tempModifier: 0, minPModifier: 0 }

    // Final temperature = user preset + button modifier + context modifier
    // Clamped to safe range [0.1, 2.0] to prevent model issues
    const finalTemperature = Math.max(0.1, Math.min(2.0, 
      temperature + buttonModifier.tempModifier + contextModifier.tempModifier
    ))

    // Final minP = user preset + button modifier + context modifier  
    // Clamped to safe range [0.0, 1.0]
    const finalMinP = Math.max(0.0, Math.min(1.0,
      minP + buttonModifier.minPModifier + contextModifier.minPModifier
    ))

    onGenerationStart()

    try {
      if (isTauri()) {
        const unsubscribe = await onGenerationChunk((chunk) => {
          if (chunk.done) {
            onGenerationEnd()
            toast.success(`${actionButton.name} generated!`)
          } else {
            onStreamChunk(chunk.content)
          }
        })

        let styleInstruction = ''
        if (actionAutoMode) {
          if (contextType === 'violent') {
            styleInstruction = 'Style: Use raw, graphic, and visceral language. Be unflinching in depicting physical reality.'
          } else if (contextType === 'romantic') {
            styleInstruction = 'Style: Use poetic, sensory, and intimate language. Focus on tenderness and emotional depth.'
          } else {
            styleInstruction = 'Style: Use vivid and engaging language appropriate to the scene.'
          }
        } else {
          styleInstruction = 'Style: Use neutral, descriptive language.'
        }

        const creativePrompt = buildCreativePrompt()

        // Build Story Rail section if content exists
        const storyRailSection = storyRailContent.trim() 
          ? `\n[FRAMEWORK INSTRUCTIONS - STORY RAIL]\nHere is the complete story path: "${storyRailContent}"\nYou must use this text ONLY as a reference for coherence, not as content to copy.\n` 
          : ''

        const prompt = `${creativePrompt}${storyRailSection}

You are a Visceral Narration Engine. Your role is to generate ultra-precise narrative segments based on action buttons.

GOLDEN RULE: Never summarize. Never anticipate the next action. Respond strictly according to the button clicked and the number of sentences chosen.

ACTOR: ${actorName}
${actionSelectedActor !== 'narrator' ? `CHARACTER: ${actorName} performs the action.` : 'NARRATOR: The narrator describes the action.'}

[ACTION TO GENERATE NOW]
Subject: ${actorName}
Action: ${actionDescription}

ACTION BUTTON: ${actionButton.name}
FOCUS: ${actionButton.focus}
INSTRUCTION: ${actionButton.instruction}

LENGTH CONSTRAINT: Exactly ${actionPhraseCount} sentence${actionPhraseCount > 1 ? 's' : ''}.

${styleInstruction}

STORY CONTEXT:
${editorContent.slice(-1500)}

[CRITICAL BLOCKING CONSTRAINT]
Absolute prohibition on anticipating the scenario continuation.
Never skip steps, never summarize, never anticipate.
Focus exclusively on the current action requested.

RESPONSE (exactly ${actionPhraseCount} sentence${actionPhraseCount > 1 ? 's' : ''}):`

        await generateText({
          mode: 'action',
          text: prompt,
          context: editorContent.slice(-1500),
          temperature: finalTemperature,
          maxTokens,
          inputLanguage,
          language: outputLanguage,
          selectedTone: creativeTone,
          customStyleName: creativeStyle,
          customGenreName: creativeCategory,
          customStyleInstruction: creativeTheme,
          // Generation Preset Parameters (from selected preset, with intelligent modifications)
          topP,
          topK,
          minP: finalMinP,
          repeatPenalty,
          frequencyPenalty,
          presencePenalty,
        })

        setTimeout(() => unsubscribe(), 60000)
      } else {
        await new Promise(r => setTimeout(r, 1000))
        const demoResponse = `[${actionButton.name}] ${actorName}: ${actionDescription}... The visceral narrative unfolds with intense detail.`
        onStreamChunk(demoResponse)
        onGenerationEnd()
        toast.success(`${actionButton.name} generated! (Demo)`)
      }
    } catch (error) {
      console.error('Action generation error:', error)
      onGenerationEnd()
      toast.error('Generation failed')
    }
  }

  // Tab definitions
  const tabs = [
    { id: 'action', label: 'Action', icon: Zap },
    { id: 'story', label: 'Story', icon: BookOpen },
  ] as const

  return (
    <div className="flex flex-col h-[340px] border border-border/50 rounded-xl bg-gradient-to-b from-background to-muted/20 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border/30 bg-muted/10 overflow-x-auto shrink-0 h-9">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium transition-all relative whitespace-nowrap flex-1",
              activeTab === tab.id
                ? "text-violet-600 dark:text-violet-400 bg-violet-500/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTabAIAssistant"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {/* ============ ACTION TAB ============ */}
          {activeTab === 'action' && (
            <motion.div
              key="action"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute inset-0 overflow-hidden p-3 flex flex-col gap-2"
            >
              {/* TOP BAR - Full Width Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Story Rail Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowStoryRail(!showStoryRail)}
                    className={cn(
                      "h-8 px-3 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                      showStoryRail
                        ? "bg-violet-500/20 border-violet-400/50 text-violet-600 dark:text-violet-400"
                        : "bg-muted/30 border-border/50 hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <Compass className="h-3.5 w-3.5" />
                    Rail
                  </button>
                  {storyRailContent.trim() && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-background" />
                  )}
                </div>

                {/* Auto Mode Toggle */}
                <button
                  onClick={() => setActionAutoMode(!actionAutoMode)}
                  className={cn(
                    "h-8 px-3 rounded-lg text-xs font-medium border transition-all",
                    actionAutoMode
                      ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted/30 border-border/50 hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  {actionAutoMode ? 'AUTO ON' : 'AUTO OFF'}
                </button>

                {/* Phrase Count Dropdown */}
                <Select value={String(actionPhraseCount)} onValueChange={(v) => setActionPhraseCount(Number(v))}>
                  <SelectTrigger className="h-8 w-[120px] text-xs bg-muted/30 border-border/50">
                    <SelectValue placeholder="Phrases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="text-xs">1 Phrase</SelectItem>
                    <SelectItem value="2" className="text-xs">2 Phrases</SelectItem>
                    <SelectItem value="3" className="text-xs">3 Phrases</SelectItem>
                    <SelectItem value="4" className="text-xs">4 Phrases</SelectItem>
                    <SelectItem value="5" className="text-xs">5 Phrases</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* MAIN CONTENT - Two Columns with matching frames */}
              <div className="flex gap-2 flex-1 min-h-0">
                {/* LEFT COLUMN - Description */}
                <div className="flex-1 flex flex-col bg-muted/20 border border-border/50 rounded-lg p-2">
                  <Textarea
                    placeholder="Describe the action to enrich with vivid details..."
                    value={actionDescription}
                    onChange={(e) => setActionDescription(e.target.value)}
                    className="flex-1 resize-none text-sm bg-transparent border-0 focus:ring-0 focus-visible:ring-0 p-0"
                  />
                </div>

                {/* RIGHT COLUMN - Actor & Action Buttons in matching frame */}
                <div className="flex-1 flex flex-col gap-1 p-2 bg-muted/20 border border-border/50 rounded-lg">
                  {/* Actor Dropdown */}
                  <Select value={actionSelectedActor} onValueChange={setActionSelectedActor}>
                    <SelectTrigger className="h-7 text-xs bg-background/50 border-border/50">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Select actor" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="narrator" className="text-xs">
                        <div className="flex items-center gap-2">
                          <Eye className="h-3.5 w-3.5 text-violet-500" />
                          Narrator
                        </div>
                      </SelectItem>
                      {characters.slice(0, 8).map((char) => (
                        <SelectItem key={char.id} value={char.id} className="text-xs">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-sky-500" />
                            {char.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Action Buttons */}
                  <div className="flex-1 flex flex-col justify-between">
                    {ACTION_BUTTONS.map((action) => {
                      const getActionStyle = (color: string) => {
                        const styles: Record<string, string> = {
                          'rose': 'bg-rose-500/15 border-rose-400/40 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400',
                          'amber': 'bg-amber-500/15 border-amber-400/40 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400',
                          'sky': 'bg-sky-500/15 border-sky-400/40 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400',
                          'emerald': 'bg-emerald-500/15 border-emerald-400/40 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400',
                          'violet': 'bg-violet-500/15 border-violet-400/40 hover:bg-violet-500/25 text-violet-600 dark:text-violet-400',
                        }
                        return styles[color] || 'bg-muted/30 border-border/50 hover:bg-muted/50 text-muted-foreground'
                      }

                      const getIcon = (id: string) => {
                        const icons: Record<string, React.ReactNode> = {
                          'physical-impact': <Zap className="h-3.5 w-3.5" />,
                          'internal-sensations': <Heart className="h-3.5 w-3.5" />,
                          'expression-cry': <Wind className="h-3.5 w-3.5" />,
                          'scene-atmosphere': <Eye className="h-3.5 w-3.5" />,
                          'secret-thought': <Brain className="h-3.5 w-3.5" />,
                        }
                        return icons[id] || <Zap className="h-3.5 w-3.5" />
                      }
                      
                      return (
                        <button
                          key={action.id}
                          onClick={() => isGenerating ? handleStopGeneration() : generateActionContent(action.id)}
                          disabled={!isModelLoaded || !actionDescription.trim()}
                          className={cn(
                            "w-full h-7 px-3 rounded-md text-xs font-medium border transition-all flex items-center gap-2",
                            getActionStyle(action.color),
                            (!isModelLoaded || !actionDescription.trim()) && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {getIcon(action.id)}
                          <span className="truncate">{action.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* CENTERED Generate Button */}
              <div className="flex justify-center shrink-0 pt-1">
                <Button
                  onClick={() => isGenerating ? handleStopGeneration() : generateActionContent(ACTION_BUTTONS[0].id)}
                  disabled={!isModelLoaded || !actionDescription.trim()}
                  className={cn(
                    "h-8 text-xs font-medium border-0 w-[320px]",
                    isGenerating
                      ? "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600"
                      : "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Square className="h-3.5 w-3.5 mr-1.5" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5 mr-1.5" />
                      Generate
                    </>
                  )}
                </Button>
              </div>

              {/* Story Rail Popup */}
              {showStoryRail && (
                <div 
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowStoryRail(false)}
                >
                  <div 
                    className="w-[500px] max-w-[90vw] bg-background border border-border/50 rounded-xl shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
                      <div className="flex items-center gap-2">
                        <Compass className="h-4 w-4 text-violet-500" />
                        <span className="text-sm font-semibold text-foreground">Story Master Rail</span>
                      </div>
                      <button
                        onClick={() => setShowStoryRail(false)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted/40 text-muted-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {/* Body */}
                    <div className="p-4">
                      <Textarea
                        value={storyRailContent}
                        onChange={(e) => setStoryRailContent(e.target.value)}
                        placeholder="Enter your story path here...&#10;&#10;Example:&#10;• Chapter 1: The hero discovers a mysterious map&#10;• Chapter 2: Journey through the dark forest&#10;• Chapter 3: Encounter with the wise hermit&#10;• Chapter 4: The final confrontation&#10;&#10;This will be used as a reference for coherence in both Action and Story generation."
                        className="min-h-[300px] max-h-[50vh] overflow-y-auto text-sm leading-relaxed"
                      />
                    </div>
                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/10">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {storyRailContent.split('\n').filter(l => l.trim()).length} lines
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {storyRailContent.length} characters
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setStoryRailContent('')}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-3"
                        >
                          Clear
                        </Button>
                        <Button
                          onClick={handleSaveStoryRail}
                          size="sm"
                          className="h-7 text-xs px-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 border-0"
                        >
                          Save Rail
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ============ STORY TAB ============ */}
          {activeTab === 'story' && (
            <motion.div
              key="story"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute inset-0 overflow-y-auto p-3"
            >
              <div className="space-y-2">
                {/* INPUT MODE */}
                {storyMode === 'input' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium text-muted-foreground">Story Situations</span>
                        <span className="text-[9px] text-muted-foreground">One per line</span>
                      </div>
                      <Textarea
                        placeholder="Enter each situation on a new line:

The hero enters the dark forest
A mysterious figure appears
They exchange cryptic words
The figure vanishes into shadows
The hero continues deeper..."
                        value={storyInputText}
                        onChange={(e) => setStoryInputText(e.target.value)}
                        className="min-h-[120px] resize-none text-xs"
                      />
                      {storyInputText.trim() && (
                        <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
                          <span className="px-1.5 py-0.5 rounded bg-muted/30 border border-border/30">
                            {storyInputText.split('\n').filter(line => line.trim()).length} situations
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={parseSituations}
                        disabled={!storyInputText.trim()}
                        className="flex-1 h-8 text-xs bg-gradient-to-r from-violet-500 to-fuchsia-500 border-0"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Preview & Edit
                      </Button>
                    </div>
                  </>
                )}

                {/* SITUATIONS MODE */}
                {storyMode === 'situations' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {storySituations.length} Situations (drag to reorder)
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetStory}
                        className="h-6 text-[10px] px-2"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                    </div>

                    <Reorder.Group
                      axis="y"
                      values={storySituations}
                      onReorder={handleReorderSituations}
                      className="space-y-1.5"
                    >
                      {storySituations.map((situation, index) => (
                        <Reorder.Item
                          key={situation.id}
                          value={situation}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30 cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-[10px] font-medium text-muted-foreground w-4">{index + 1}.</span>
                          <span className="text-xs flex-1 truncate">{situation.text}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeSituation(situation.id)
                            }}
                            className="h-5 w-5 shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>

                    <div className="flex gap-2">
                      <Button
                        onClick={generateStory}
                        disabled={!isModelLoaded || storySituations.length === 0}
                        className="flex-1 h-8 text-xs bg-gradient-to-r from-violet-500 to-fuchsia-500 border-0"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Generate Story
                      </Button>
                    </div>
                  </>
                )}

                {/* GENERATING MODE */}
                {storyMode === 'generating' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        Generating ({currentGeneratingIndex + 1}/{storySituations.length})
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStopGeneration}
                        className="h-6 text-[10px] px-2 text-red-500 hover:text-red-600"
                      >
                        <Square className="h-3 w-3 mr-1" />
                        Stop
                      </Button>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentGeneratingIndex + 1) / storySituations.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    {/* Situation Status List */}
                    <div className="space-y-1 max-h-[180px] overflow-y-auto">
                      {storySituations.map((situation, index) => (
                        <div
                          key={situation.id}
                          className={cn(
                            "flex items-center gap-2 p-1.5 rounded text-[10px]",
                            situation.status === 'done' && "bg-emerald-500/10 border border-emerald-500/20",
                            situation.status === 'generating' && "bg-violet-500/10 border border-violet-500/20",
                            situation.status === 'pending' && "bg-muted/30",
                            situation.status === 'error' && "bg-red-500/10 border border-red-500/20"
                          )}
                        >
                          {situation.status === 'done' && (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          )}
                          {situation.status === 'generating' && (
                            <Loader2 className="h-3.5 w-3.5 text-violet-500 animate-spin shrink-0" />
                          )}
                          {situation.status === 'pending' && (
                            <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                          )}
                          {situation.status === 'error' && (
                            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          )}
                          <span className="font-medium text-muted-foreground">{index + 1}.</span>
                          <span className="truncate flex-1">{situation.text}</span>
                          {situation.status === 'done' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => regenerateParagraph(index)}
                              disabled={isGenerating}
                              className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Done - Show insert button */}
                    {currentGeneratingIndex === -1 && !isGenerating && storySituations.some(s => s.status === 'done') && (
                      <div className="flex gap-2">
                        <Button
                          onClick={resetStory}
                          variant="outline"
                          className="flex-1 h-8 text-xs"
                        >
                          New Story
                        </Button>
                        <Button
                          onClick={insertStoryToEditor}
                          className="flex-1 h-8 text-xs bg-gradient-to-r from-violet-500 to-fuchsia-500 border-0"
                        >
                          <ArrowRight className="h-3 w-3 mr-1" />
                          Insert to Editor
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
