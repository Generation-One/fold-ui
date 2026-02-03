import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import styles from './ProjectSettings.module.css';

// Inlined to avoid Vite HMR import issues
interface AlgorithmConfig {
  strength_weight: number;
  decay_half_life_days: number;
}

interface ProjectSettingsProps {
  projectId: string;
}

export function ProjectSettings({ projectId }: ProjectSettingsProps) {
  const { data: config, error, isLoading } = useSWR<AlgorithmConfig>(
    `algorithm-config-${projectId}`,
    () => api.getAlgorithmConfig(projectId)
  );

  const [strengthWeight, setStrengthWeight] = useState(0.3);
  const [decayHalfLife, setDecayHalfLife] = useState(30);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync state with fetched config
  useEffect(() => {
    if (config) {
      setStrengthWeight(config.strength_weight);
      setDecayHalfLife(config.decay_half_life_days);
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSuccess(null);

    try {
      // Save algorithm config
      await api.updateAlgorithmConfig(projectId, {
        strength_weight: strengthWeight,
        decay_half_life_days: decayHalfLife,
      });

      mutate(`algorithm-config-${projectId}`);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading settings...</div>;
  }

  if (error) {
    return <div className={styles.error}>Failed to load algorithm configuration</div>;
  }

  return (
    <div className={styles.container}>
      {success && <div className={styles.success}>{success}</div>}
      {saveError && <div className={styles.error}>{saveError}</div>}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Search Algorithm</span>
        </div>
        <div className={styles.cardContent}>
          <p className={styles.description}>
            Configure how search results are ranked by balancing semantic relevance against recency.
          </p>

          <div className={styles.sliderGroup}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>Recency Weight</label>
              <span className={styles.sliderValue}>{(strengthWeight * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={strengthWeight * 100}
              onChange={(e) => setStrengthWeight(Number(e.target.value) / 100)}
              className={styles.slider}
            />
            <div className={styles.sliderLabels}>
              <span>Pure Semantic</span>
              <span>Pure Recency</span>
            </div>
            <p className={styles.hint}>
              Controls the blend between semantic relevance and recency.
              Lower values prioritise meaning, higher values prioritise recent content.
            </p>
          </div>

          <div className={styles.sliderGroup}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>Decay Half-Life</label>
              <span className={styles.sliderValue}>{decayHalfLife} days</span>
            </div>
            <input
              type="range"
              min="1"
              max="365"
              value={decayHalfLife}
              onChange={(e) => setDecayHalfLife(Number(e.target.value))}
              className={styles.slider}
            />
            <div className={styles.sliderLabels}>
              <span>1 day (aggressive)</span>
              <span>365 days (slow)</span>
            </div>
            <p className={styles.hint}>
              How quickly old memories fade. After this many days, content strength drops to 50%.
              Lower values mean more aggressive recency bias.
            </p>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          onClick={handleSave}
          disabled={saving}
          className={styles.primaryBtn}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
