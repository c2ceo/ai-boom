import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Sparkles } from "lucide-react";

interface BombThumbnailProps {
  imageUrl?: string | null;
  videoUrl?: string | null;
  caption?: string | null;
  onClick: () => void;
  overlay?: React.ReactNode;
}

const BombThumbnail = ({ imageUrl, videoUrl, caption, onClick, overlay }: BombThumbnailProps) => {
  const [exploding, setExploding] = useState(false);

  const handleClick = () => {
    setExploding(true);
    setTimeout(() => {
      onClick();
      setExploding(false);
    }, 600);
  };

  return (
    <div className="relative flex items-center justify-center p-1">
      {/* Explosion particles */}
      <AnimatePresence>
        {exploding && (
          <>
            {[...Array(8)].map((_, i) => {
              const angle = (i / 8) * 360;
              const rad = (angle * Math.PI) / 180;
              return (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 rounded-full bg-accent z-20"
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{
                    x: Math.cos(rad) * 60,
                    y: Math.sin(rad) * 60,
                    scale: 0,
                    opacity: 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              );
            })}
            {[...Array(6)].map((_, i) => {
              const angle = (i / 6) * 360 + 30;
              const rad = (angle * Math.PI) / 180;
              return (
                <motion.div
                  key={`s-${i}`}
                  className="absolute w-2 h-2 rounded-full bg-primary z-20"
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{
                    x: Math.cos(rad) * 40,
                    y: Math.sin(rad) * 40,
                    scale: 0,
                    opacity: 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* Bomb shape */}
      <motion.div
        className="relative w-full cursor-pointer"
        style={{ aspectRatio: "1" }}
        onClick={handleClick}
        animate={
          exploding
            ? { scale: [1, 1.15, 0], rotate: [0, 5, -5, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={exploding ? { duration: 0.5 } : { type: "spring", stiffness: 300 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Fuse */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
          <div className="w-1 h-3 bg-muted-foreground rounded-full" />
          <motion.div
            className="w-2 h-2 rounded-full bg-accent"
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        </div>

        {/* Bomb body */}
        <div
          className="h-full w-full overflow-hidden border-2 border-border shadow-lg"
          style={{
            borderRadius: "50% 50% 50% 50% / 55% 55% 45% 45%",
          }}
        >
          {videoUrl ? (
            <div className="relative h-full w-full">
              <video
                src={videoUrl}
                className="h-full w-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="h-5 w-5 text-white fill-white drop-shadow-md" />
              </div>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={caption || "AI content"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {overlay}
        </div>
      </motion.div>
    </div>
  );
};

export default BombThumbnail;
