import { useState, useEffect, useCallback } from 'react';

export type LoadingStage = 'data-flow' | 'interface-emergence' | 'logo-reveal' | 'complete';

interface AppLoaderState {
  isLoading: boolean;
  progress: number; // 0-100
  stage: LoadingStage;
  stageProgress: number; // 0-100 for current stage
}

interface AppLoaderConfig {
  minimumDuration: number; // Minimum loading time in ms
  maximumDuration: number; // Maximum loading time in ms
  stageTransitionDuration: number; // Time for each stage transition
}

const defaultConfig: AppLoaderConfig = {
  minimumDuration: 2000, // 2 seconds minimum
  maximumDuration: 5000, // 5 seconds maximum
  stageTransitionDuration: 600, // 600ms per stage
};

export function useAppLoader(config: Partial<AppLoaderConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  
  const [state, setState] = useState<AppLoaderState>({
    isLoading: true,
    progress: 0,
    stage: 'data-flow',
    stageProgress: 0,
  });

  const [startTime] = useState(() => Date.now());
  const [appReady, setAppReady] = useState(false);

  // Simulate app initialization detection
  useEffect(() => {
    // In a real app, this would check for:
    // - Component mount completion
    // - Resource loading
    // - Initial data fetching
    // - Theme initialization
    
    const checkAppReady = () => {
      // Check if critical components are ready
      const rootElement = document.getElementById('root');
      const hasRootElement = rootElement?.children.length && rootElement.children.length > 0;
      const hasThemeClass = document.documentElement.classList.contains('light') || 
                           document.documentElement.classList.contains('dark');
      
      if (hasRootElement && hasThemeClass) {
        setAppReady(true);
      }
    };

    // Check immediately and then periodically
    checkAppReady();
    const interval = setInterval(checkAppReady, 100);
    
    // Fallback: mark as ready after maximum duration
    const timeout = setTimeout(() => setAppReady(true), finalConfig.maximumDuration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [finalConfig.maximumDuration]);

  // Progress and stage management
  useEffect(() => {
    if (!state.isLoading) return;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const minDuration = finalConfig.minimumDuration;
      
      // Don't complete until both minimum time has passed AND app is ready
      const canComplete = elapsed >= minDuration && appReady;
      
      if (canComplete) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          progress: 100,
          stage: 'complete',
          stageProgress: 100,
        }));
        return;
      }

      // Calculate overall progress
      const timeProgress = Math.min((elapsed / minDuration) * 100, appReady ? 95 : 80);
      const overallProgress = appReady ? Math.min(timeProgress, 95) : timeProgress;

      // Determine current stage based on progress
      let currentStage: LoadingStage;
      let stageProgress: number;

      if (overallProgress < 40) {
        currentStage = 'data-flow';
        stageProgress = (overallProgress / 40) * 100;
      } else if (overallProgress < 80) {
        currentStage = 'interface-emergence';
        stageProgress = ((overallProgress - 40) / 40) * 100;
      } else {
        currentStage = 'logo-reveal';
        stageProgress = ((overallProgress - 80) / 20) * 100;
      }

      setState(prev => ({
        ...prev,
        progress: overallProgress,
        stage: currentStage,
        stageProgress: Math.min(stageProgress, 100),
      }));
    };

    const interval = setInterval(updateProgress, 50); // Update every 50ms for smooth animation
    updateProgress(); // Initial update

    return () => clearInterval(interval);
  }, [startTime, appReady, finalConfig.minimumDuration, state.isLoading]);

  // Force complete function for testing/debugging
  const forceComplete = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      progress: 100,
      stage: 'complete',
      stageProgress: 100,
    }));
  }, []);

  // Reset function to restart loading
  const reset = useCallback(() => {
    setState({
      isLoading: true,
      progress: 0,
      stage: 'data-flow',
      stageProgress: 0,
    });
    setAppReady(false);
  }, []);

  return {
    ...state,
    forceComplete,
    reset,
    config: finalConfig,
  };
}

// Helper function to get stage timing for animations
export function getStageConfig(stage: LoadingStage) {
  const configs = {
    'data-flow': {
      duration: 1000,
      animations: ['particle-flow', 'gradient-waves'],
      colors: ['primary', 'accent'],
    },
    'interface-emergence': {
      duration: 800,
      animations: ['skeleton-pulse', 'panel-fade'],
      colors: ['muted', 'foreground'],
    },
    'logo-reveal': {
      duration: 600,
      animations: ['logo-scale', 'text-reveal'],
      colors: ['primary', 'foreground'],
    },
    'complete': {
      duration: 300,
      animations: ['slide-out'],
      colors: [],
    },
  };

  return configs[stage];
}