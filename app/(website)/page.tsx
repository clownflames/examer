import React from 'react'
import HeroSection from './components/HeroSection'
import TierListSection from './components/TierListSection'
import StatsSection from './components/StatsSection'
import FeaturedDemandsSection from './components/FeaturedDemandsSection'
import UpcomingDeadlinesSection from './components/UpcomingDeadlinesSection'

export default function page() {
  return (
    <div>
      <HeroSection />
      <StatsSection />
      <FeaturedDemandsSection />
      <TierListSection />
      <UpcomingDeadlinesSection />
    </div>
  )
}
