"use client";

import { useEffect, useRef, useState } from "react";

/** Porta de useTypewriter em opencdj/src/App.jsx — revela `text` caractere a
 * caractere, cursor pisca depois de terminar. */
function useTypewriter(text: string, speed = 90, delay = 800) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;

    const start = setTimeout(() => {
      interval = setInterval(() => {
        indexRef.current += 1;
        setDisplayed(text.slice(0, indexRef.current));
        if (indexRef.current >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [text, speed, delay]);

  return { displayed, done };
}

export function OpencdjTypewriter({ text }: { text: string }) {
  const { displayed, done } = useTypewriter(text);

  return (
    <p className="heroSubline">
      <span className="prompt">&gt; </span>
      {displayed}
      <span className={`cursor${done ? " cursorBlink" : ""}`}>_</span>
    </p>
  );
}
