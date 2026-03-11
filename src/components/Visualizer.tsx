import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  stream: MediaStream | null;
  isListening: boolean;
}

export function Visualizer({ stream, isListening }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioCtxRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();

  useEffect(() => {
    if (!isListening || !stream) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.2)');
    gradient.addColorStop(1, 'rgba(34, 211, 238, 0.8)');
    ctx.fillStyle = gradient;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [isListening, stream]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={40} 
      className="w-full h-10 opacity-50"
    />
  );
}
