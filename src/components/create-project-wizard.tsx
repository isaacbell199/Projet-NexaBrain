'use client'

import { useState } from 'react'
import { useStore, GENERATION_PRESETS, type GenerationPreset } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Trash2,
  Users,
  Settings2,
  BookOpen,
  Cpu,
  Sparkles,
  PenTool,
  Palette,
  Layers,
  Wand2,
  FileText,
  Globe,
  X,
  Edit3,
  Save,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  isTauri,
  createProject,
  createCharacter,
  createLoreNote,
  createLocation,
} from '@/lib/tauri-api'

// ============================================================================
// Types
// ============================================================================

interface WizardCharacter {
  id: string
  name: string
  description: string
}

interface CreativeOption {
  id: string
  name: string
  description: string
}

interface CustomCreativeOption extends CreativeOption {
  isCustom: true
}

interface WizardData {
  // Step 1: Project Info
  title: string
  description: string
  
  // Step 2: Characters
  characters: WizardCharacter[]
  
  // Step 3: Creative Settings
  category: string
  customCategory: CreativeOption | null
  tone: string
  customTone: CreativeOption | null
  writingStyle: string
  customStyle: CreativeOption | null
  theme: string
  customTheme: CreativeOption | null
  preset: string
  
  // Step 4: Lore
  loreDescription: string
  worldLocation: string
  timePeriod: string
}

const initialWizardData: WizardData = {
  title: '',
  description: '',
  characters: [],
  category: 'none',
  customCategory: null,
  tone: 'none',
  customTone: null,
  writingStyle: 'none',
  customStyle: null,
  theme: 'none',
  customTheme: null,
  preset: 'none',
  loreDescription: '',
  worldLocation: '',
  timePeriod: '',
}

// ============================================================================
// Predefined Options
// ============================================================================

const CATEGORIES: CreativeOption[] = [
  { id: 'fantasy', name: 'Fantasy', description: 'Magical worlds, mythical creatures, epic quests' },
  { id: 'scifi', name: 'Science Fiction', description: 'Future tech, space exploration, alien worlds' },
  { id: 'romance', name: 'Romance', description: 'Love stories, emotional connections, relationships' },
  { id: 'thriller', name: 'Thriller', description: 'Suspense, tension, unexpected twists' },
  { id: 'horror', name: 'Horror', description: 'Fear, supernatural, psychological terror' },
  { id: 'mystery', name: 'Mystery', description: 'Investigations, puzzles, hidden secrets' },
  { id: 'adventure', name: 'Adventure', description: 'Journey, exploration, exciting challenges' },
  { id: 'historical', name: 'Historical', description: 'Period settings, historical events, past eras' },
  { id: 'contemporary', name: 'Contemporary', description: 'Modern day, realistic settings, current events' },
  { id: 'dystopian', name: 'Dystopian', description: 'Dark futures, oppressive societies, survival' },
]

const TONES: CreativeOption[] = [
  { id: 'dark', name: 'Dark', description: 'Grim, serious, intense atmosphere' },
  { id: 'light', name: 'Light', description: 'Cheerful, optimistic, uplifting' },
  { id: 'mysterious', name: 'Mysterious', description: 'Enigmatic, puzzling, secretive' },
  { id: 'dramatic', name: 'Dramatic', description: 'Emotional, powerful, impactful' },
  { id: 'humorous', name: 'Humorous', description: 'Funny, witty, entertaining' },
  { id: 'melancholic', name: 'Melancholic', description: 'Sad, reflective, nostalgic' },
  { id: 'romantic', name: 'Romantic', description: 'Passionate, intimate, tender' },
  { id: 'suspenseful', name: 'Suspenseful', description: 'Tense, anxious, anticipating' },
  { id: 'epic', name: 'Epic', description: 'Grand, heroic, monumental' },
  { id: 'whimsical', name: 'Whimsical', description: 'Playful, fanciful, imaginative' },
]

const WRITING_STYLES: CreativeOption[] = [
  { id: 'descriptive', name: 'Descriptive', description: 'Rich imagery, detailed descriptions' },
  { id: 'minimalist', name: 'Minimalist', description: 'Clean, concise, essential words only' },
  { id: 'poetic', name: 'Poetic', description: 'Lyrical, rhythmic, artistic language' },
  { id: 'conversational', name: 'Conversational', description: 'Natural, dialogue-heavy, casual' },
  { id: 'academic', name: 'Academic', description: 'Formal, scholarly, precise' },
  { id: 'journalistic', name: 'Journalistic', description: 'Factual, objective, report-style' },
  { id: 'cinematic', name: 'Cinematic', description: 'Visual, scene-by-scene, movie-like' },
  { id: 'stream', name: 'Stream of Consciousness', description: 'Inner thoughts, flowing, unfiltered' },
  { id: 'noir', name: 'Noir', description: 'Gritty, shadowy, hard-boiled' },
  { id: 'fairy-tale', name: 'Fairy Tale', description: 'Magical, timeless, folklore-inspired' },
]

const THEMES: CreativeOption[] = [
  { id: 'love', name: 'Love & Relationships', description: 'Romance, friendship, family bonds' },
  { id: 'revenge', name: 'Revenge', description: 'Justice, retaliation, consequences' },
  { id: 'redemption', name: 'Redemption', description: 'Atonement, second chances, transformation' },
  { id: 'quest', name: 'Quest & Journey', description: 'Adventure, discovery, personal growth' },
  { id: 'power', name: 'Power & Corruption', description: 'Authority, influence, moral decay' },
  { id: 'identity', name: 'Identity', description: 'Self-discovery, belonging, authenticity' },
  { id: 'survival', name: 'Survival', description: 'Endurance, resilience, life vs death' },
  { id: 'freedom', name: 'Freedom & Oppression', description: 'Liberty, rebellion, control' },
  { id: 'sacrifice', name: 'Sacrifice', description: 'Giving up, altruism, devotion' },
  { id: 'transformation', name: 'Transformation', description: 'Change, metamorphosis, evolution' },
]

// ============================================================================
// Step Configuration
// ============================================================================

const STEPS = [
  { id: 1, title: 'Project', icon: FileText, description: 'Basic information' },
  { id: 2, title: 'Characters', icon: Users, description: 'Your story people' },
  { id: 3, title: 'Settings', icon: Settings2, description: 'Creative options' },
  { id: 4, title: 'Lore', icon: Globe, description: 'World building' },
]

// ============================================================================
// Component
// ============================================================================

interface CreateProjectWizardProps {
  open: boolean
  onClose: () => void
  onComplete: (project: { id: string; name: string; description?: string | null }) => void
}

export function CreateProjectWizard({ open, onClose, onComplete }: CreateProjectWizardProps) {
  const store = useStore()
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<WizardData>(initialWizardData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Custom Option Dialogs
  const [customDialogOpen, setCustomDialogOpen] = useState(false)
  const [customDialogType, setCustomDialogType] = useState<'category' | 'tone' | 'style' | 'theme' | 'preset'>('category')
  const [customName, setCustomName] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  
  // Custom Preset Form Data (full parameters like World Studio)
  const [presetFormData, setPresetFormData] = useState<GenerationPreset>({
    id: '',
    name: '',
    description: '',
    temperature: 0.75,
    topP: 0.92,
    topK: 50,
    minP: 0.03,
    repeatPenalty: 1.12,
    frequencyPenalty: 0.4,
    presencePenalty: 0.3,
    maxTokens: 400,
  })
  
  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return data.title.trim().length >= 2
      case 2:
        return true // Characters are optional
      case 3:
        return true // Creative settings are optional
      case 4:
        return true // Lore is optional - this is the last step
      default:
        return false
    }
  }
  
  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }
  
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }
  
  // Character Management
  const addCharacter = () => {
    setData(prev => ({
      ...prev,
      characters: [
        ...prev.characters,
        { id: `char-${Date.now()}`, name: '', description: '' }
      ]
    }))
  }
  
  const removeCharacter = (id: string) => {
    setData(prev => ({
      ...prev,
      characters: prev.characters.filter(c => c.id !== id)
    }))
  }
  
  const updateCharacter = (id: string, field: 'name' | 'description', value: string) => {
    setData(prev => ({
      ...prev,
      characters: prev.characters.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      )
    }))
  }
  
  // Custom Option Management
  const openCustomDialog = (type: 'category' | 'tone' | 'style' | 'theme' | 'preset') => {
    setCustomDialogType(type)
    setCustomName('')
    setCustomDescription('')
    // Reset preset form data when opening preset dialog
    if (type === 'preset') {
      setPresetFormData({
        id: `custom-preset-${Date.now()}`,
        name: '',
        description: '',
        temperature: 0.75,
        topP: 0.92,
        topK: 50,
        minP: 0.03,
        repeatPenalty: 1.12,
        frequencyPenalty: 0.4,
        presencePenalty: 0.3,
        maxTokens: 400,
      })
    }
    setCustomDialogOpen(true)
  }
  
  const saveCustomOption = () => {
    if (customDialogType === 'preset') {
      // Use full preset form data
      if (!presetFormData.name.trim()) {
        toast.error('Please enter a preset name')
        return
      }
      const customPreset: GenerationPreset = {
        ...presetFormData,
        id: `custom-preset-${Date.now()}`,
      }
      store.addCustomPreset(customPreset)
      setData(prev => ({ ...prev, preset: customPreset.id }))
      setCustomDialogOpen(false)
      toast.success(`Preset "${customPreset.name}" created!`)
      return
    }
    
    if (!customName.trim()) {
      toast.error('Name is required')
      return
    }
    
    const customOption: CustomCreativeOption = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      description: customDescription.trim(),
      isCustom: true,
    }
    
    switch (customDialogType) {
      case 'category':
        setData(prev => ({ ...prev, category: customOption.id, customCategory: customOption }))
        break
      case 'tone':
        setData(prev => ({ ...prev, tone: customOption.id, customTone: customOption }))
        break
      case 'style':
        setData(prev => ({ ...prev, writingStyle: customOption.id, customStyle: customOption }))
        break
      case 'theme':
        setData(prev => ({ ...prev, theme: customOption.id, customTheme: customOption }))
        break
    }
    
    setCustomDialogOpen(false)
    toast.success('Custom option created')
  }
  
  // Submit
  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      if (isTauri()) {
        // 1. Create Project
        const project = await createProject({
          name: data.title,
          description: data.description || undefined,
          genre: data.category !== 'none' ? data.category : undefined,
        })
        
        // 2. Create Characters
        for (const char of data.characters) {
          if (char.name.trim()) {
            await createCharacter({
              projectId: project.id,
              name: char.name,
            })
          }
        }
        
        // 3. Create Lore Note (World Building)
        if (data.loreDescription.trim() || data.worldLocation.trim() || data.timePeriod.trim()) {
          await createLoreNote({
            projectId: project.id,
            title: 'World Overview',
            category: 'world-building',
            content: [
              data.loreDescription && `**Story Beginning:**\n${data.loreDescription}`,
              data.worldLocation && `**Location:**\n${data.worldLocation}`,
              data.timePeriod && `**Time Period:**\n${data.timePeriod}`,
            ].filter(Boolean).join('\n\n'),
          })
        }
        
        // 4. Create Location if specified
        if (data.worldLocation.trim()) {
          await createLocation({
            projectId: project.id,
            name: data.worldLocation,
            description: data.loreDescription || undefined,
          })
        }
        
        // 5. Save Creative Settings to Store (for AI generation)
        store.setProjectCategory(data.category)
        store.setProjectTone(data.tone)
        store.setProjectWritingStyle(data.writingStyle)
        store.setProjectTheme(data.theme)
        store.setProjectPreset(data.preset)
        
        // 5b. Save Custom Creative Options to Store
        store.setProjectCustomCategory(data.customCategory)
        store.setProjectCustomTone(data.customTone)
        store.setProjectCustomStyle(data.customStyle)
        store.setProjectCustomTheme(data.customTheme)
        
        // 6. Apply preset if selected
        if (data.preset !== 'none') {
          const preset = GENERATION_PRESETS.find(p => p.id === data.preset) || store.customPresets.find(p => p.id === data.preset)
          if (preset) {
            store.applyPreset(preset)
          }
        }
        
        toast.success('Project created successfully!')
        onComplete({ id: project.id, name: project.name, description: project.description })
      } else {
        // Browser demo mode
        toast.success('Project created (demo mode)')
        onComplete({ id: 'demo-project', name: data.title, description: data.description })
      }
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error('Failed to create project')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Reset on close
  const handleClose = () => {
    setData(initialWizardData)
    setCurrentStep(1)
    onClose()
  }
  
  // Get preset details
  const getSelectedPreset = (): GenerationPreset | undefined => {
    if (data.preset === 'none') return undefined
    return GENERATION_PRESETS.find(p => p.id === data.preset) || store.customPresets.find(p => p.id === data.preset)
  }
  
  return (
    <>
      <Dialog open={open} onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent 
          className="max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* Header with Stepper */}
          <div className="border-b border-border/50 bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <DialogTitle className="text-lg font-semibold">Create New Project</DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Step {currentStep} of 4
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Stepper */}
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                const isActive = currentStep === step.id
                const isCompleted = currentStep > step.id
                
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <motion.div
                        initial={false}
                        animate={{
                          scale: isActive ? 1.1 : 1,
                          backgroundColor: isCompleted 
                            ? 'rgb(34, 197, 94)' 
                            : isActive 
                              ? 'rgb(168, 85, 247)' 
                              : 'rgb(39, 39, 42)',
                        }}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-5 w-5 text-white" />
                        ) : (
                          <Icon className={cn(
                            "h-5 w-5",
                            isActive ? "text-white" : "text-muted-foreground"
                          )} />
                        )}
                      </motion.div>
                      <span className={cn(
                        "text-[10px] mt-1 font-medium",
                        isActive ? "text-purple-500" : "text-muted-foreground"
                      )}>
                        {step.title}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={cn(
                        "h-0.5 flex-1 mx-1 mb-6",
                        currentStep > step.id ? "bg-emerald-500" : "bg-border"
                      )} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          
          {/* Content */}
          <ScrollArea className="flex-1 h-[400px]">
            <div className="p-6">
              <AnimatePresence mode="wait">
                {/* Step 1: Project Info */}
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-5 w-5 text-purple-500" />
                      <h3 className="text-base font-medium">Project Information</h3>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-sm">Project Title *</Label>
                      <Input
                        id="title"
                        value={data.title}
                        onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter your story title..."
                        className="h-10"
                        maxLength={100}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {data.title.length}/100 characters
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm">Description</Label>
                      <textarea
                        id="description"
                        value={data.description}
                        onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Briefly describe your story idea, plot, or concept..."
                        className="w-full h-32 p-3 text-sm bg-background border border-border/50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
                        maxLength={1000}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {data.description.length}/1000 characters
                      </p>
                    </div>
                  </motion.div>
                )}
                
                {/* Step 2: Characters */}
                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-purple-500" />
                        <h3 className="text-base font-medium">Characters</h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addCharacter}
                        className="h-8 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Character
                      </Button>
                    </div>
                    
                    {data.characters.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No characters yet</p>
                        <p className="text-xs mt-1">Add characters to bring your story to life</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                        {data.characters.map((char, index) => (
                          <motion.div
                            key={char.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                Character {index + 1}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCharacter(char.id)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <Input
                              value={char.name}
                              onChange={(e) => updateCharacter(char.id, 'name', e.target.value)}
                              placeholder="Character name..."
                              className="h-9 text-sm"
                            />
                            <textarea
                              value={char.description}
                              onChange={(e) => updateCharacter(char.id, 'description', e.target.value)}
                              placeholder="Character description, role, personality..."
                              className="w-full h-16 p-2 text-xs bg-background border border-border/50 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                            />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
                
                {/* Step 3: Creative Settings */}
                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Settings2 className="h-5 w-5 text-purple-500" />
                      <h3 className="text-base font-medium">Creative Settings</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Category */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5" />Category
                        </Label>
                        <div className="flex gap-1">
                          <Select value={data.category} onValueChange={(v) => setData(prev => ({ ...prev, category: v }))}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select category..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">None</SelectItem>
                              {CATEGORIES.map(cat => (
                                <SelectItem key={cat.id} value={cat.id} className="text-xs">
                                  {cat.name}
                                </SelectItem>
                              ))}
                              {data.customCategory && (
                                <SelectItem value={data.customCategory.id} className="text-xs">
                                  ⭐ {data.customCategory.name}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCustomDialog('category')}
                            className="h-9 w-9 p-0"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Tone */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Palette className="h-3.5 w-3.5" />Tone
                        </Label>
                        <div className="flex gap-1">
                          <Select value={data.tone} onValueChange={(v) => setData(prev => ({ ...prev, tone: v }))}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select tone..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">None</SelectItem>
                              {TONES.map(tone => (
                                <SelectItem key={tone.id} value={tone.id} className="text-xs">
                                  {tone.name}
                                </SelectItem>
                              ))}
                              {data.customTone && (
                                <SelectItem value={data.customTone.id} className="text-xs">
                                  ⭐ {data.customTone.name}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCustomDialog('tone')}
                            className="h-9 w-9 p-0"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Writing Style */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1.5">
                          <PenTool className="h-3.5 w-3.5" />Writing Style
                        </Label>
                        <div className="flex gap-1">
                          <Select value={data.writingStyle} onValueChange={(v) => setData(prev => ({ ...prev, writingStyle: v }))}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select style..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">None</SelectItem>
                              {WRITING_STYLES.map(style => (
                                <SelectItem key={style.id} value={style.id} className="text-xs">
                                  {style.name}
                                </SelectItem>
                              ))}
                              {data.customStyle && (
                                <SelectItem value={data.customStyle.id} className="text-xs">
                                  ⭐ {data.customStyle.name}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCustomDialog('style')}
                            className="h-9 w-9 p-0"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Theme */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />Theme
                        </Label>
                        <div className="flex gap-1">
                          <Select value={data.theme} onValueChange={(v) => setData(prev => ({ ...prev, theme: v }))}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select theme..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">None</SelectItem>
                              {THEMES.map(theme => (
                                <SelectItem key={theme.id} value={theme.id} className="text-xs">
                                  {theme.name}
                                </SelectItem>
                              ))}
                              {data.customTheme && (
                                <SelectItem value={data.customTheme.id} className="text-xs">
                                  ⭐ {data.customTheme.name}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCustomDialog('theme')}
                            className="h-9 w-9 p-0"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Generation Preset */}
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5" />Generation Preset
                      </Label>
                      <div className="flex gap-1">
                        <Select value={data.preset} onValueChange={(v) => setData(prev => ({ ...prev, preset: v }))}>
                          <SelectTrigger className="h-9 text-xs flex-1">
                            <SelectValue placeholder="Select preset..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs">None (use defaults)</SelectItem>
                            {GENERATION_PRESETS.map(preset => (
                              <SelectItem key={preset.id} value={preset.id} className="text-xs">
                                {preset.name}
                              </SelectItem>
                            ))}
                            {store.customPresets.map(preset => (
                              <SelectItem key={preset.id} value={preset.id} className="text-xs">
                                ⭐ {preset.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCustomDialog('preset')}
                          className="h-9 w-9 p-0"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {getSelectedPreset() && (
                        <p className="text-[10px] text-muted-foreground">
                          {getSelectedPreset()?.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Quick Info */}
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <p className="text-[10px] text-purple-400">
                        💡 All settings are optional. The AI will use these to guide generation.
                      </p>
                    </div>
                  </motion.div>
                )}
                
                {/* Step 4: Lore */}
                {currentStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="h-5 w-5 text-purple-500" />
                      <h3 className="text-base font-medium">World Building</h3>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />Story Beginning
                      </Label>
                      <textarea
                        value={data.loreDescription}
                        onChange={(e) => setData(prev => ({ ...prev, loreDescription: e.target.value }))}
                        placeholder="How does the story begin? What's the initial situation, conflict, or hook?"
                        className="w-full h-24 p-3 text-sm bg-background border border-border/50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5" />Location / World
                        </Label>
                        <Input
                          value={data.worldLocation}
                          onChange={(e) => setData(prev => ({ ...prev, worldLocation: e.target.value }))}
                          placeholder="Where does it take place?"
                          className="h-9 text-sm"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Edit3 className="h-3.5 w-3.5" />Time Period
                        </Label>
                        <Input
                          value={data.timePeriod}
                          onChange={(e) => setData(prev => ({ ...prev, timePeriod: e.target.value }))}
                          placeholder="When does it happen?"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* Final Step Info */}
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-[10px] text-emerald-400">
                        ✅ Ready to create! All your settings will be saved and used for AI generation. Configure your AI model in Model Management.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
          
          {/* Footer */}
          <div className="border-t border-border/50 px-6 py-4 flex items-center justify-between bg-muted/20">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="h-9 text-sm"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            
            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                disabled={!canGoNext()}
                className="h-9 text-sm bg-gradient-to-r from-purple-600 to-pink-600 border-0"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canGoNext() || isSubmitting}
                className="h-9 text-sm bg-gradient-to-r from-emerald-600 to-cyan-600 border-0"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Project
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Custom Option Dialog */}
      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className={cn("max-w-md max-h-[90vh]", customDialogType === 'preset' && "max-w-lg")}>
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              {customDialogType === 'preset' ? (
                <Settings className="h-4 w-4 text-purple-500" />
              ) : (
                <Wand2 className="h-4 w-4 text-purple-500" />
              )}
              Create Custom {customDialogType === 'preset' ? 'Preset' : customDialogType.charAt(0).toUpperCase() + customDialogType.slice(1)}
            </DialogTitle>
            {customDialogType === 'preset' && (
              <DialogDescription>
                Configure your own generation parameters for specific writing styles.
              </DialogDescription>
            )}
          </DialogHeader>
          
          {customDialogType === 'preset' ? (
            // Full preset form with all sliders (like World Studio)
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {/* Name */}
              <div className="space-y-2">
                <Label className="text-xs">Preset Name</Label>
                <Input
                  placeholder="e.g., My Thriller Style"
                  value={presetFormData.name}
                  onChange={(e) => setPresetFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              
              {/* Description */}
              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <Textarea
                  placeholder="What is this preset best for?"
                  value={presetFormData.description}
                  onChange={(e) => setPresetFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="h-16 text-sm"
                />
              </div>
              
              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Temperature</Label>
                  <Badge variant="outline" className="text-[10px]">{presetFormData.temperature.toFixed(2)}</Badge>
                </div>
                <Slider
                  value={[presetFormData.temperature]}
                  onValueChange={([value]) => setPresetFormData(prev => ({ ...prev, temperature: value }))}
                  min={0.1}
                  max={2}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground">Lower = more focused, Higher = more creative</p>
              </div>
              
              {/* Top P */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Top P (Nucleus Sampling)</Label>
                  <Badge variant="outline" className="text-[10px]">{presetFormData.topP.toFixed(2)}</Badge>
                </div>
                <Slider
                  value={[presetFormData.topP]}
                  onValueChange={([value]) => setPresetFormData(prev => ({ ...prev, topP: value }))}
                  min={0.5}
                  max={1}
                  step={0.01}
                  className="w-full"
                />
              </div>
              
              {/* Top K */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Top K</Label>
                  <Badge variant="outline" className="text-[10px]">{presetFormData.topK}</Badge>
                </div>
                <Slider
                  value={[presetFormData.topK]}
                  onValueChange={([value]) => setPresetFormData(prev => ({ ...prev, topK: value }))}
                  min={1}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
              
              {/* Min P */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Min P</Label>
                  <Badge variant="outline" className="text-[10px]">{presetFormData.minP.toFixed(2)}</Badge>
                </div>
                <Slider
                  value={[presetFormData.minP]}
                  onValueChange={([value]) => setPresetFormData(prev => ({ ...prev, minP: value }))}
                  min={0}
                  max={0.5}
                  step={0.01}
                  className="w-full"
                />
              </div>
              
              {/* Repeat Penalty */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Repeat Penalty</Label>
                  <Badge variant="outline" className="text-[10px]">{presetFormData.repeatPenalty.toFixed(2)}</Badge>
                </div>
                <Slider
                  value={[presetFormData.repeatPenalty]}
                  onValueChange={([value]) => setPresetFormData(prev => ({ ...prev, repeatPenalty: value }))}
                  min={1}
                  max={2}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground">Higher = more repetition avoidance</p>
              </div>
              
              {/* Frequency Penalty */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Frequency Penalty</Label>
                  <Badge variant="outline" className="text-[10px]">{presetFormData.frequencyPenalty.toFixed(2)}</Badge>
                </div>
                <Slider
                  value={[presetFormData.frequencyPenalty]}
                  onValueChange={([value]) => setPresetFormData(prev => ({ ...prev, frequencyPenalty: value }))}
                  min={0}
                  max={2}
                  step={0.05}
                  className="w-full"
                />
              </div>
              
              {/* Presence Penalty */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Presence Penalty</Label>
                  <Badge variant="outline" className="text-[10px]">{presetFormData.presencePenalty.toFixed(2)}</Badge>
                </div>
                <Slider
                  value={[presetFormData.presencePenalty]}
                  onValueChange={([value]) => setPresetFormData(prev => ({ ...prev, presencePenalty: value }))}
                  min={0}
                  max={2}
                  step={0.05}
                  className="w-full"
                />
              </div>
              
              {/* Max Tokens */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Max Tokens</Label>
                  <Badge variant="outline" className="text-[10px]">{presetFormData.maxTokens}</Badge>
                </div>
                <Slider
                  value={[presetFormData.maxTokens]}
                  onValueChange={([value]) => setPresetFormData(prev => ({ ...prev, maxTokens: value }))}
                  min={100}
                  max={1000}
                  step={50}
                  className="w-full"
                />
              </div>
            </div>
          ) : (
            // Simple form for other custom options
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={`Enter ${customDialogType} name...`}
                  className="h-9 text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Describe this option..."
                  className="w-full h-20 p-2 text-sm bg-background border border-border/50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCustomDialogOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button onClick={saveCustomOption} className="h-8 text-xs bg-gradient-to-r from-purple-600 to-pink-600 border-0">
              <Check className="h-3.5 w-3.5 mr-1" />
              {customDialogType === 'preset' ? 'Create Preset' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
