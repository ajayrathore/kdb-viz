import React from 'react';
import { TrendingUp } from 'lucide-react';
import { useAppLoader } from '@/hooks/use-app-loader';

interface LoadingScreenProps {
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const { isLoading, progress } = useAppLoader();

  // Handle completion
  React.useEffect(() => {
    if (!isLoading && onComplete) {
      // Small delay for final animation to complete
      setTimeout(onComplete, 300);
    }
  }, [isLoading, onComplete]);

  if (!isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background transition-opacity duration-300 opacity-0 pointer-events-none">
        {/* Slide-out animation */}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
      {/* Main content container */}
      <div className="text-center space-y-8">
        {/* Logo section */}
        <div className="flex flex-col items-center space-y-6">
          {/* Main logo with pulsing animation */}
          <div className="relative">
            <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 border-2 border-primary/20">
              <TrendingUp className="h-10 w-10 text-primary simple-pulse" />
            </div>
            
            {/* Subtle glow effect */}
            <div className="absolute inset-0 w-20 h-20 rounded-3xl bg-primary/5 simple-glow" />
          </div>

          {/* Brand text */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              KDB+ Visualizer
            </h1>
            <p className="text-muted-foreground">
              Loading your analytics workspace...
            </p>
          </div>
        </div>

        {/* Progress section */}
        <div className="w-80 max-w-sm mx-auto space-y-4">
          {/* Progress bar */}
          <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out simple-progress-glow"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Progress percentage */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Please wait</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for testing
export function LoadingScreenDemo() {
  const [show, setShow] = React.useState(true);

  return (
    <div>
      {show && (
        <LoadingScreen onComplete={() => setShow(false)} />
      )}
      {!show && (
        <div className="p-8 text-center">
          <h2 className="text-xl mb-4">Loading Complete!</h2>
          <button 
            onClick={() => setShow(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Show Loading Again
          </button>
        </div>
      )}
    </div>
  );
}