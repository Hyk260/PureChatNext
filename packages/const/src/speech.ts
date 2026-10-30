import { isBuiltinProviderId, isValidProviderId } from './provider'

export const QWEN_SPEECH_MODEL = 'qwen-audio-3.1-tts-flash'
export const QWEN_SPEECH_MODEL_3_0 = 'qwen-audio-3.0-tts-flash'
export const QWEN_SPEECH_MODELS = [QWEN_SPEECH_MODEL, QWEN_SPEECH_MODEL_3_0] as const
export const QWEN_TTS_TAGS = [
  'sad',
  'amazed',
  'deep and loud shouting',
  'trembling',
  'angry',
  'excited',
  'sarcastic',
  'curious',
  'like dracula',
  'bored',
  'tired',
  'scornful',
  'shouting',
  'asmr',
  'panicked',
  'mischievously',
  'empathetic',
  'whispers',
  'reluctantly',
  'crying',
  'serious',
  'very slowly',
  'very fast',
  'gasp',
  'sighing',
  'clears throat',
  'giggles',
  'laughing',
  'cough',
  'snorts',
] as const
export const OPENAI_SPEECH_MODELS = ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'] as const
export const QQ_SPEECH_REPLY_MODES = ['smart', 'always', 'never'] as const
export type QQSpeechReplyMode = (typeof QQ_SPEECH_REPLY_MODES)[number]
export type SpeechVoiceOption = { label: string; value: string }
export const DEFAULT_QQ_SPEECH_CONFIG = {
  model: QWEN_SPEECH_MODEL,
  provider: 'bailian',
  replyMode: 'smart',
  voice: 'anruorou_v3.1',
} as const
/** Qwen Audio 3.1 TTS Flash voices from the official Bailian voice catalog. */
export const QWEN_SPEECH_VOICE_OPTIONS: SpeechVoiceOption[] = [
  { label: '安若柔', value: 'anruorou_v3.1' },
  { label: '龙安欢_v3.1', value: 'longanhuan_v3.1' },
  { label: '龙安灵心_v3.1', value: 'longanlingxin_v3.1' },
  { label: '龙安风悦_v3.1', value: 'longanfengyue_v3.1' },
  { label: '许南川', value: 'xunanchuan_v3.1' },
  { label: '于小云', value: 'yuxiaoyun_v3.1' },
  { label: '乔小娇', value: 'qiaoxiaojiao_v3.1' },
  { label: '夏小晨', value: 'xiaxiaochen_v3.1' },
  { label: '安明远', value: 'anmingyuan_v3.1' },
  { label: '温怀清', value: 'wenhuaiqing_v3.1' },
  { label: '安小岚', value: 'anxiaolan_v3.1' },
  { label: '谢舒柔', value: 'xieshurou_v3.1' },
  { label: '白清岚', value: 'baiqinglan_v3.1' },
  { label: '许玉远', value: 'xuyuyuan_v3.1' },
  { label: '闻怀之', value: 'wenhuaizhi_v3.1' },
  { label: '萧行之', value: 'xiaoxingzhi_v3.1' },
  { label: '顾云舒', value: 'guyunshu_v3.1' },
  { label: '霍拙石', value: 'huozhuoshi_v3.1' },
  { label: '叶清禾', value: 'yeqinghe_v3.1' },
  { label: '云欢欢', value: 'yunhuanhuan_v3.1' },
  { label: '徐小俏', value: 'xuxiaoqiao_v3.1' },
  { label: '白安然', value: 'baianran_v3.1' },
  { label: '许言初', value: 'xuyanchu_v3.1' },
  { label: '叶知晴', value: 'yezhiqing_v3.1' },
  { label: '安迪', value: 'andi_v3.1' },
  { label: '安语晴', value: 'anyuqing_v3.1' },
  { label: '林小灵', value: 'linxiaoling_v3.1' },
  { label: '龙菲菲_v3.1', value: 'longfeifei_v3.1' },
  { label: '龙婧_v3.1', value: 'longjing_v3.1' },
  { label: '龙嫱_v3.1', value: 'longqiang_v3.1' },
  { label: '龙颜_v3.1', value: 'longyan_v3.1' },
  { label: '龙小白_v3.1', value: 'longxiaobai_v3.1' },
  { label: '龙悦_v3.1', value: 'longyue_v3.1' },
  { label: '龙橙_v3.1', value: 'longcheng_v3.1' },
  { label: '龙老铁_v3.1', value: 'longlaotie_v3.1' },
  { label: '龙邵_v3.1', value: 'longshao_v3.1' },
  { label: '龙书_v3.1', value: 'longshu_v3.1' },
  { label: '龙泽_v3.1', value: 'longze_v3.1' },
  { label: '龙浩_v3.1', value: 'longhao_v3.1' },
  { label: '龙津_v3.1', value: 'longjin_v3.1' },
  { label: '龙楠_v3.1', value: 'longnan_v3.1' },
  { label: '龙硕_v3.1', value: 'longshuo_v3.1' },
  { label: '龙天_v3.1', value: 'longtian_v3.1' },
  { label: '龙小诚_v3.1', value: 'longxiaocheng_v3.1' },
  { label: '龙可_v3.1', value: 'longke_v3.1' },
  { label: '龙安元妃_v3.1', value: 'longanyuanfei_v3.1' },
  { label: '龙杰力豆_v3.1', value: 'longjielidou_v3.1' },
  { label: '龙安灵希_v3.1', value: 'longanlingxi_v3.1' },
  { label: '龙火火_v3.1', value: 'longhuohuo_v3.1' },
  { label: '龙应桃_v3.1', value: 'longyingtao_v3.1' },
  { label: '龙安雅_v3.1', value: 'longanya_v3.1' },
  { label: '龙婉_v3.1', value: 'longwan_v3.1' },
  { label: '龙星_v3.1', value: 'longxing_v3.1' },
  { label: '龙华_v3.1', value: 'longhua_v3.1' },
  { label: '龙寒_v3.1', value: 'longhan_v3.1' },
  { label: '龙安智_v3.1', value: 'longanzhi_v3.1' },
  { label: '龙哲_v3.1', value: 'longzhe_v3.1' },
  { label: '龙安洋_v3.1', value: 'longanyang_v3.1' },
  { label: '李白_v3.1', value: 'libai_v3.1' },
  { label: '龙铃_v3.1', value: 'longling_v3.1' },
  { label: '龙牛牛_v3.1', value: 'longniuniu_v3.1' },
  { label: '龙闪闪_v3.1', value: 'longshanshan_v3.1' },
  { label: '龙泡泡_v3.1', value: 'longpaopao_v3.1' },
  { label: 'loongstella_v3.1', value: 'loongstella_v3.1' },
  { label: '龙媛_v3.1', value: 'longyuan_v3.1' },
  { label: '龙妙_v3.1', value: 'longmiao_v3.1' },
  { label: '龙三叔_v3.1', value: 'longsanshu_v3.1' },
  { label: '龙安莉_v3.1', value: 'longanli_v3.1' },
  { label: '龙安温_v3.1', value: 'longanwen_v3.1' },
  { label: '龙安朗_v3.1', value: 'longanlang_v3.1' },
  { label: '龙小夏_v3.1', value: 'longxiaoxia_v3.1' },
  { label: '龙安冲_v3.1', value: 'longanchong_v3.1' },
]
export const QWEN_SPEECH_VOICES = QWEN_SPEECH_VOICE_OPTIONS.map(({ value }) => value)
export const QWEN_SPEECH_VOICES_3_0 = [
  'longanfengyue',
  'longanyuanfei',
  'longanlingxi',
  'longanxiaoxin',
  'longanhuan_v3.6',
  'longjielidou_v3.6',
  'longpaopao_v3.6',
  'longhuohuo_v3.6',
  'longchuanshu_v3.6',
  'loongmary',
  'loongeva_v3.6',
  'loongjohn',
]
export const OPENAI_SPEECH_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

export function isBailianQwenSpeechModel(provider: string, model: string): boolean {
  return provider === 'bailian' && QWEN_SPEECH_MODELS.some((speechModel) => speechModel === model)
}

const QWEN_TTS_TAG_SET = new Set<string>(QWEN_TTS_TAGS)

/** Remove only documented Qwen TTS control tags, preserving other bracketed text. */
export function stripQwenTtsTags(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, (tag, name: string) => (QWEN_TTS_TAG_SET.has(name.toLowerCase()) ? '' : tag))
}

export const QQ_SPEECH_LIMITS = {
  bytes: 5 * 1024 * 1024,
  characters: 300,
  durationMs: 30_000,
  senderPerMinute: 3,
  bindingPerMinute: 20,
  concurrent: 2,
} as const

export function speechModelProtocol(provider: string, model: string): 'bailian' | 'openai' | undefined {
  if (provider === 'bailian' && QWEN_SPEECH_MODELS.some((id) => id === model))
    return 'bailian'
  if (provider === 'openai' && OPENAI_SPEECH_MODELS.some((id) => id === model)) return 'openai'
  if (isValidProviderId(provider) && !isBuiltinProviderId(provider) && model.trim()) return 'openai'
  return undefined
}

export const speechVoices = (provider: string, model?: string) => {
  if (provider !== 'bailian') return OPENAI_SPEECH_VOICES
  return model === QWEN_SPEECH_MODEL_3_0 ? QWEN_SPEECH_VOICES_3_0 : QWEN_SPEECH_VOICES
}

export function isQQSpeechReplyMode(value: unknown): value is QQSpeechReplyMode {
  return typeof value === 'string' && QQ_SPEECH_REPLY_MODES.some((mode) => mode === value)
}

export function speechVoiceOptions(provider: string, model?: string): SpeechVoiceOption[] {
  if (provider === 'bailian' && model !== QWEN_SPEECH_MODEL_3_0) return QWEN_SPEECH_VOICE_OPTIONS
  return speechVoices(provider, model).map((voice) => ({ label: voice, value: voice }))
}

export function defaultSpeechVoice(provider: string, model?: string): string {
  const options = speechVoiceOptions(provider, model)
  if (provider === 'bailian' && model !== QWEN_SPEECH_MODEL_3_0) return DEFAULT_QQ_SPEECH_CONFIG.voice
  return options[0]?.value ?? ''
}

export function speechConfigError(config: {
  provider: string
  model: string
  voice?: string
  endpoint?: string
}): string | undefined {
  if (!speechModelProtocol(config.provider, config.model)) return '暂不支持此语音模型或协议'
  if (
    isBuiltinProviderId(config.provider) &&
    config.voice &&
    !speechVoices(config.provider, config.model).includes(config.voice)
  )
    return '音色与语音模型不兼容'
  if (config.provider === 'bailian') {
    if (!config.endpoint) return undefined
    try {
      const url = new URL(config.endpoint ?? '')
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !url.pathname.endsWith('/api/v1/services/audio/tts/SpeechSynthesizer')
      )
        throw new Error('endpoint')
    } catch {
      return '请填写百炼 Workspace 对应的 HTTPS 语音 API 地址（以 /api/v1/services/audio/tts/SpeechSynthesizer 结尾）'
    }
  } else if (config.endpoint) return 'OpenAI 兼容语音使用服务商设置中的 API 地址'
  return undefined
}
