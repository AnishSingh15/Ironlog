'use client';

import {
  Close as CloseIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Refresh as ResetIcon,
  VolumeOff as VolumeOffIcon,
  VolumeUp as VolumeUpIcon,
} from '@mui/icons-material';
import { IconButton, Slider } from '@mui/material';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

interface RestTimerProps {
  onTimerEnd?: () => void;
  onClose?: () => void;
  defaultTime?: number; // in seconds
  isVisible?: boolean;
}

export function RestTimer({
  onTimerEnd,
  onClose,
  defaultTime = 180, // 3 minutes default
  isVisible = false,
}: RestTimerProps) {
  const [timeLeft, setTimeLeft] = useState(defaultTime);
  const [isRunning, setIsRunning] = useState(false);
  const [targetTime, setTargetTime] = useState(defaultTime);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio context for bell sound
  useEffect(() => {
    // Create a simple bell sound using Web Audio API
    const createBellSound = () => {
      if (typeof window === 'undefined') return;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      const playBell = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Bell-like frequency progression
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.5);

        // Bell-like volume envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);

        oscillator.type = 'sine';
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 2);
      };

      return playBell;
    };

    if (!audioRef.current) {
      audioRef.current = createBellSound() as any;
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (isSoundEnabled && audioRef.current) {
      try {
        (audioRef.current as any)();
      } catch (error) {
        console.log('Could not play notification sound:', error);
      }
    }
  }, [isSoundEnabled]);

  const startTimer = useCallback(() => {
    if (timeLeft <= 0) {
      setTimeLeft(targetTime);
    }
    setIsRunning(true);
  }, [timeLeft, targetTime]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(targetTime);
  }, [targetTime]);

  const handleTimeChange = useCallback(
    (_: Event, newValue: number | number[]) => {
      const value = Array.isArray(newValue) ? newValue[0] : newValue;
      setTargetTime(value);
      if (!isRunning) {
        setTimeLeft(value);
      }
    },
    [isRunning]
  );

  // Timer logic
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            playNotificationSound();
            onTimerEnd?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft, playNotificationSound, onTimerEnd]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = targetTime > 0 ? ((targetTime - timeLeft) / targetTime) * 100 : 0;
  const circleRadius = 80;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const progressOffset = circleCircumference - (progress / 100) * circleCircumference;
  const urgent = timeLeft <= 10;

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-[320px] rounded-xl border border-border-default bg-surface-1 p-6 text-center shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">Rest Timer</h3>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" className="text-text-tertiary" />
          </IconButton>
        )}
      </div>

      <div className="relative mb-4 inline-block">
        <svg width="200" height="200" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="100"
            cy="100"
            r={circleRadius}
            stroke="hsl(var(--il-border))"
            strokeWidth="8"
            fill="transparent"
          />
          <motion.circle
            cx="100"
            cy="100"
            r={circleRadius}
            stroke={urgent ? 'hsl(var(--il-danger))' : 'hsl(var(--il-accent))'}
            strokeWidth="8"
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circleCircumference}
            strokeDashoffset={progressOffset}
            initial={{ strokeDashoffset: circleCircumference }}
            animate={{ strokeDashoffset: progressOffset }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </svg>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <motion.div
            animate={{ scale: urgent && isRunning ? [1, 1.08, 1] : 1 }}
            transition={{ duration: 1, repeat: urgent && isRunning ? Infinity : 0 }}
            className={urgent ? 'text-danger' : 'text-text-primary'}
          >
            <p className="font-mono text-4xl font-bold tabular-nums">{formatTime(timeLeft)}</p>
          </motion.div>
        </div>
      </div>

      <div className="mb-4 px-2">
        <p className="mb-2 text-sm font-medium text-text-secondary">
          Rest time: <span className="font-mono">{formatTime(targetTime)}</span>
        </p>
        <Slider
          value={targetTime}
          onChange={handleTimeChange}
          min={30}
          max={600}
          step={30}
          disabled={isRunning}
          marks={[
            { value: 60, label: '1m' },
            { value: 120, label: '2m' },
            { value: 180, label: '3m' },
            { value: 240, label: '4m' },
            { value: 300, label: '5m' },
          ]}
          valueLabelDisplay="auto"
          valueLabelFormat={value => formatTime(value)}
        />
        <p className="mt-1 text-xs text-text-tertiary">
          {isRunning ? 'Stop the timer to change the rest time' : 'Drag to set a custom rest time'}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-1.5">
        {[60, 90, 120, 180, 240, 300].map(seconds => (
          <button
            key={seconds}
            disabled={isRunning}
            onClick={() => {
              if (!isRunning) {
                setTargetTime(seconds);
                setTimeLeft(seconds);
              }
            }}
            className={
              targetTime === seconds
                ? 'min-w-[48px] rounded-md bg-accent px-2 py-1 font-mono text-xs font-semibold text-accent-foreground'
                : 'min-w-[48px] rounded-md border border-border-default px-2 py-1 font-mono text-xs text-text-secondary hover:border-border-strong disabled:opacity-50'
            }
          >
            {formatTime(seconds)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <IconButton onClick={resetTimer}>
          <ResetIcon className="text-text-secondary" />
        </IconButton>

        <button
          onClick={isRunning ? pauseTimer : startTimer}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground"
        >
          {isRunning ? <PauseIcon fontSize="large" /> : <PlayIcon fontSize="large" />}
        </button>

        <IconButton onClick={() => setIsSoundEnabled(!isSoundEnabled)}>
          {isSoundEnabled ? (
            <VolumeUpIcon className="text-text-secondary" />
          ) : (
            <VolumeOffIcon className="text-text-secondary" />
          )}
        </IconButton>
      </div>

      {timeLeft === 0 && (
        <motion.p
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="mt-3 text-sm font-semibold text-success"
        >
          Rest complete
        </motion.p>
      )}
    </motion.div>
  );
}
