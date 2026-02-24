import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Sparkles, Flame } from "lucide-react";

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
    }, 800);
  };

  return (
    <div className="relative flex items-center justify-center p-2 pt-6">
      {/* Explosion ring flash */}
      <AnimatePresence>
        {exploding && (
          <>
            {/* Big shockwave ring */}
            <motion.div
              className="absolute inset-0 z-30 rounded-full border-4 border-accent"
              initial={{ scale: 0.3, opacity: 1 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ borderRadius: "50%" }}
            />
            {/* Flash */}
            <motion.div
              className="absolute z-20 rounded-full bg-accent/60"
              style={{ width: "120%", height: "120%", borderRadius: "50%" }}
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 1.8, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
            {/* Large debris particles */}
            {[...Array(12)].map((_, i) => {
              const angle = (i / 12) * 360;
              const rad = (angle * Math.PI) / 180;
              const dist = 70 + Math.random() * 40;
              return (
                <motion.div
                  key={`big-${i}`}
                  className="absolute z-20 rounded-full"
                  style={{
                    width: 6 + Math.random() * 8,
                    height: 6 + Math.random() * 8,
                    background: i % 3 === 0 ? "hsl(var(--accent))" : i % 3 === 1 ? "hsl(30, 100%, 55%)" : "hsl(45, 100%, 55%)",
                  }}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{
                    x: Math.cos(rad) * dist,
                    y: Math.sin(rad) * dist,
                    scale: 0,
                    opacity: 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 + Math.random() * 0.2, ease: "easeOut" }}
                />
              );
            })}
            {/* Small spark particles */}
            {[...Array(10)].map((_, i) => {
              const angle = (i / 10) * 360 + 18;
              const rad = (angle * Math.PI) / 180;
              const dist = 40 + Math.random() * 30;
              return (
                <motion.div
                  key={`sm-${i}`}
                  className="absolute z-20 rounded-full bg-primary"
                  style={{ width: 4, height: 4 }}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{
                    x: Math.cos(rad) * dist,
                    y: Math.sin(rad) * dist - 10,
                    scale: 0,
                    opacity: 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
                />
              );
            })}
            {/* Smoke puffs */}
            {[...Array(5)].map((_, i) => {
              const angle = (i / 5) * 360 + 36;
              const rad = (angle * Math.PI) / 180;
              return (
                <motion.div
                  key={`smoke-${i}`}
                  className="absolute z-10 rounded-full bg-muted-foreground/30"
                  style={{ width: 20 + Math.random() * 15, height: 20 + Math.random() * 15 }}
                  initial={{ x: 0, y: 0, scale: 0.5, opacity: 0.6 }}
                  animate={{
                    x: Math.cos(rad) * 50,
                    y: Math.sin(rad) * 50 - 20,
                    scale: 2,
                    opacity: 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
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
            ? { scale: [1, 1.2, 0], rotate: [0, 8, -8, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={exploding ? { duration: 0.6 } : { type: "spring", stiffness: 300 }}
        whileHover={{ scale: 1.08, rotate: 2 }}
        whileTap={{ scale: 0.92 }}
      >
        {/* Fuse string — curved */}
        <svg
          className="absolute -top-5 left-1/2 -translate-x-1/2 z-10"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M12 22 C12 16, 18 14, 14 8"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        {/* Fuse flame */}
        <motion.div
          className="absolute -top-7 left-1/2 z-20"
          style={{ marginLeft: "1px" }}
          animate={{
            y: [0, -2, 0],
            scale: [1, 1.3, 0.9, 1.2, 1],
            rotate: [0, -10, 10, -5, 0],
          }}
          transition={{ repeat: Infinity, duration: 0.6 }}
        >
          <Flame className="h-5 w-5 text-orange-400 drop-shadow-[0_0_6px_rgba(255,160,0,0.8)]" fill="hsl(30, 100%, 55%)" />
        </motion.div>

        {/* Bomb body — classic round cartoon bomb */}
        <div
          className="h-full w-full overflow-hidden border-[3px] border-foreground/70 shadow-xl relative"
          style={{
            borderRadius: "50%",
            boxShadow: "inset -8px -8px 20px rgba(0,0,0,0.3), inset 4px 4px 10px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {/* Cartoon highlight shine */}
          <div
            className="absolute top-[12%] left-[18%] w-[25%] h-[20%] rounded-full z-10 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse, rgba(255,255,255,0.45) 0%, transparent 70%)",
              transform: "rotate(-30deg)",
            }}
          />

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
