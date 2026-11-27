import { useState } from 'react';
import { AudioSettingsScreen } from './screens/AudioSettingsScreen';
import { DubbingSettingsScreen } from './screens/DubbingSettingsScreen';
import { ExportScreen } from './screens/ExportScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ImportMovieScreen } from './screens/ImportMovieScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SlangDictionaryScreen } from './screens/SlangDictionaryScreen';
import { AppRoute, MovieProject, ProjectStatus } from './types/studio';

export default function App() {
  const [stack, setStack] = useState<AppRoute[]>([{ name: 'home' }]);
  const current = stack[stack.length - 1];

  const navigate = (route: AppRoute) => {
    setStack((prev) => [...prev, route]);
  };

  const replaceTop = (route: AppRoute) => {
    setStack((prev) => [...prev.slice(0, -1), route]);
  };

  const popBack = () => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const openProjectByStatus = (project: MovieProject) => {
    switch (project.status) {
      case ProjectStatus.COMPLETED:
        navigate({ name: 'export', projectId: project.id });
        break;
      case ProjectStatus.READY_FOR_REVIEW:
        navigate({ name: 'review', projectId: project.id });
        break;
      case ProjectStatus.PROCESSING:
      case ProjectStatus.PAUSED:
      case ProjectStatus.ERROR:
        navigate({ name: 'processing', projectId: project.id });
        break;
      default:
        navigate({ name: 'dubbing_settings', projectId: project.id });
        break;
    }
  };

  switch (current.name) {
    case 'home':
      return (
        <HomeScreen
          onSelectMovie={() => navigate({ name: 'import' })}
          onOpenProject={openProjectByStatus}
          onOpenSettings={() => navigate({ name: 'settings' })}
          onOpenSlangDictionary={() => navigate({ name: 'slang_dictionary' })}
        />
      );
    case 'import':
      return (
        <ImportMovieScreen
          onBack={popBack}
          onProjectCreated={(projectId) =>
            replaceTop({ name: 'dubbing_settings', projectId })
          }
        />
      );
    case 'dubbing_settings':
      return (
        <DubbingSettingsScreen
          projectId={current.projectId}
          onBack={popBack}
          onOpenSettings={() => navigate({ name: 'settings' })}
          onOpenSlangDictionary={() => navigate({ name: 'slang_dictionary' })}
          onNextAudioSettings={() =>
            navigate({ name: 'audio_settings', projectId: current.projectId })
          }
        />
      );
    case 'audio_settings':
      return (
        <AudioSettingsScreen
          projectId={current.projectId}
          onBack={popBack}
          onGoToProcessing={() =>
            navigate({ name: 'processing', projectId: current.projectId })
          }
        />
      );
    case 'processing':
      return (
        <ProcessingScreen
          projectId={current.projectId}
          onBack={popBack}
          onOpenAudioSettings={() =>
            navigate({ name: 'audio_settings', projectId: current.projectId })
          }
          onOpenReview={() =>
            navigate({ name: 'review', projectId: current.projectId })
          }
          onOpenExport={() =>
            navigate({ name: 'export', projectId: current.projectId })
          }
        />
      );
    case 'review':
      return (
        <ReviewScreen
          projectId={current.projectId}
          onBack={popBack}
          onGoToExport={() =>
            navigate({ name: 'export', projectId: current.projectId })
          }
        />
      );
    case 'export':
      return <ExportScreen projectId={current.projectId} onBack={popBack} />;
    case 'settings':
      return (
        <SettingsScreen
          onBack={popBack}
          onOpenSlangDictionary={() => navigate({ name: 'slang_dictionary' })}
        />
      );
    case 'slang_dictionary':
      return <SlangDictionaryScreen onBack={popBack} />;
  }
}
