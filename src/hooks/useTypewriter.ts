import { useState, useEffect, useRef } from 'react';

interface UseTypewriterOptions {
  speed?: number;
  onComplete?: () => void;
}

export function useTypewriter(text: string, options: UseTypewriterOptions = {}) {
  const { speed = 30, onComplete } = options;
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    // Reset state when text changes
    setDisplayedText('');
    indexRef.current = 0;
    
    if (!text) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);

    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      if (indexRef.current < text.length) {
        const char = text.charAt(indexRef.current);
        setDisplayedText((prev) => prev + char);
        indexRef.current += 1;
      } else {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setIsTyping(false);
        if (onComplete) {
          onComplete();
        }
      }
    }, speed);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [text, speed]); // Removed onComplete from deps to avoid re-triggering if it's not memoized

  return { displayedText, isTyping };
}
