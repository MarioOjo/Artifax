import React, { FC, useEffect, useMemo, useState, ReactNode } from 'react';
import './stats.css';
import recipesIcon from '../../../../assets/images/recipesIcon.png';
import recipesIconWhite from '../../../../assets/images/recipesIconWhite.png';
import activeJodIcon from '../../../../assets/images/activeJodIcon.png';
import completedIcon from '../../../../assets/images/completeIcon.png';
import completedIconWhite from '../../../../assets/images/completeIconWhite.png';
import blockedIcon from '../../../../assets/images/blockedIcon.png';
import blockedIconWhite from '../../../../assets/images/blockedIconWhite.png';
import { useApi, useThemeAwareIcon } from '../../../../hooks';

interface StatItem {
  label: string;
  value: number | string;
  icon: ReactNode;
}

interface TiltsState {
  [key: number]: string;
}

const StatsGrid: FC = () => {
  const api = useApi();
  const recipeIconSrc = useThemeAwareIcon(recipesIcon, recipesIconWhite);
  const activeJobsIconSrc = useThemeAwareIcon(activeJodIcon);
  const completedIconSrc = useThemeAwareIcon(completedIcon, completedIconWhite);
  const blockedIconSrc = useThemeAwareIcon(blockedIcon, blockedIconWhite);
  const [recipeCount, setRecipeCount] = useState<number>(0);
  const [activeJobs, setActiveJobs] = useState<number>(0);
  const [completedJobs, setCompletedJobs] = useState<number>(0);
  const [cancelledJobs, setCancelledJobs] = useState<number>(0);

  useEffect(() => {
    const loadStats = async (): Promise<void> => {
      try {
        const [blueprintsResponse, ordersResponse] = await Promise.all([
          api.get<any[]>('/Item/item/allItemBlueprints'),
          api.get<any[]>('/Order'),
        ]);

        const blueprints = blueprintsResponse.data ?? [];
        const orders = ordersResponse.data ?? [];

        setRecipeCount(Array.isArray(blueprints) ? blueprints.length : 0);

        const normalizedStatuses = orders.map((order) => String(order.status ?? '').trim().toLowerCase());
        setActiveJobs(normalizedStatuses.filter((status) => status === 'active').length);
        setCompletedJobs(normalizedStatuses.filter((status) => status === 'complete' || status === 'completed').length);
        setCancelledJobs(normalizedStatuses.filter((status) => status === 'cancelled' || status === 'canceled').length);
      } catch (error) {
        console.error('Failed to load crafting stats', error);
      }
    };

    void loadStats();
  }, [api]);

  const statsData: StatItem[] = useMemo(
    () => [
      {
        label: 'Recipes',
        value: recipeCount,
        icon: <img src={recipeIconSrc} alt="Recipes" />,
      },
      {
        label: 'Active Jobs',
        value: activeJobs,
        icon: <img src={activeJobsIconSrc} alt="Active Jobs" />,
      },
      {
        label: 'Completed',
        value: completedJobs,
        icon: <img src={completedIconSrc} alt="Completed" />,
      },
      {
        label: 'Cancelled',
        value: cancelledJobs,
        icon: <img src={blockedIconSrc} alt="Cancelled" />,
      },
    ],
    [recipeCount, activeJobs, completedJobs, cancelledJobs, recipeIconSrc, activeJobsIconSrc, completedIconSrc, blockedIconSrc],
  );

  const [tilts, setTilts] = useState<TiltsState>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / centerY * -2;
    const rotateY = (x - centerX) / centerX * 2;
    setTilts(prev => ({
      ...prev,
      [index]: `scale(1.02) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
    }));
  };

  const handleMouseLeave = (index: number): void => {
    setTilts(prev => ({
      ...prev,
      [index]: ''
    }));
  };

  return (
    <div className="stats-container">
      {statsData.map((item, index) => (
        <div
          key={index}
          className="info-card"
          onMouseMove={(e) => handleMouseMove(e, index)}
          onMouseLeave={() => handleMouseLeave(index)}
          style={{ transform: tilts[index] || '' }}
        >
          <div className="icon-wrapper">
            {item.icon}
          </div>
          <div className="text-wrapper">
            <span className="stat-label">{item.label}</span>
            <span className="stat-value">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;
