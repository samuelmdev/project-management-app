'use client'

import { useState } from 'react'
import { Github, FileText, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'

interface FooterProps {
  className?: string
}

export default function Footer({ className = '' }: FooterProps) {
  const [showReadmeModal, setShowReadmeModal] = useState(false)
  const [readmeContent, setReadmeContent] = useState('')
  const [loadingReadme, setLoadingReadme] = useState(false)

  const fetchReadme = async () => {
    if (readmeContent) {
      setShowReadmeModal(true)
      return
    }

    setLoadingReadme(true)
    try {
      const response = await fetch('https://raw.githubusercontent.com/samuelmdev/project-management-app/main/README.md')
      const content = await response.text()
      setReadmeContent(content)
      setShowReadmeModal(true)
    } catch (error) {
      console.error('Error fetching README:', error)
      setReadmeContent('# Error\n\nFailed to load README content. Please visit the [GitHub repository](https://github.com/samuelmdev/project-management-app) directly.')
      setShowReadmeModal(true)
    } finally {
      setLoadingReadme(false)
    }
  }

  return (
    <>
      <footer className={`bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 py-6 ${className}`}>
        <div className="max-w-6xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left side - App info */}
          <div className="flex flex-col md:flex-row items-center gap-2 text-gray-400 text-sm">
            <span>© 2024 Project Manager</span>
            <span className="hidden md:inline">•</span>
            <span>Built with Next.js & Supabase</span>
          </div>

          {/* Right side - Links */}
          <div className="flex items-center gap-4">
            <button
              onClick={fetchReadme}
              disabled={loadingReadme}
              className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">
                {loadingReadme ? 'Loading...' : 'View README'}
              </span>
            </button>
            
            <a
              href="https://github.com/samuelmdev/project-management-app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors duration-200"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </footer>

      {/* README Modal */}
      <AnimatePresence>
        {showReadmeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowReadmeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Project Documentation
                </h2>
                <button
                  onClick={() => setShowReadmeModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-6">
                <div className="prose prose-invert prose-gray max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-3xl font-bold text-white mb-6 border-b border-gray-700 pb-2">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-gray-300 mb-4 leading-relaxed">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="text-gray-300 mb-4 space-y-2">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="text-gray-300 mb-4 space-y-2">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="flex items-start">
                          <span className="text-green-500 mr-2 mt-1">•</span>
                          <span>{children}</span>
                        </li>
                      ),
                      code: ({ children }) => (
                        <code className="bg-gray-800 text-green-400 px-2 py-1 rounded text-sm font-mono">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="bg-gray-800 rounded-lg p-4 overflow-x-auto mb-4">
                          <code className="text-green-400 text-sm font-mono">
                            {children}
                          </code>
                        </pre>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-500 hover:text-green-400 underline transition-colors"
                        >
                          {children}
                        </a>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-green-500 pl-4 italic text-gray-400 my-4">
                          {children}
                        </blockquote>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto mb-4">
                          <table className="min-w-full border border-gray-700 rounded-lg">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="bg-gray-800 text-white px-4 py-2 border border-gray-700 text-left">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="text-gray-300 px-4 py-2 border border-gray-700">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {readmeContent}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-700">
                <a
                  href="https://github.com/samuelmdev/project-management-app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Github className="w-4 h-4" />
                  View on GitHub
                </a>
                <button
                  onClick={() => setShowReadmeModal(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
