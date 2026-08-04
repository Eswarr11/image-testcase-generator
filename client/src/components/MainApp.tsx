import Header from './Header'
import CredentialsSection from './CredentialsSection'
import SystemPromptSection from './SystemPromptSection'
import TestCaseGenerator from './TestCaseGenerator'

export default function MainApp() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Header />

      <main className="space-y-6">
        <CredentialsSection />
        <SystemPromptSection />
        <TestCaseGenerator />
      </main>
    </div>
  )
}
