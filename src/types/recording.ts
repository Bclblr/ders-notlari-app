export type AudioRecording = {
  id: string;
  uri: string;
  title: string;
  teacher?: string;
  subject?: string;
  /** Metering-based waveform samples captured while recording (0...1). */
  waveform?: number[];
  createdAt: string;
};
