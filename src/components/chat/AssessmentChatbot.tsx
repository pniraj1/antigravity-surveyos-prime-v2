'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, X, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AssessmentChatbotProps {
  hasFile: boolean;
  isProcessing: boolean;
  onSend: (feedback: string) => void;
}

export function AssessmentChatbot({ hasFile, isProcessing, onSend }: AssessmentChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleSend = () => {
    if (!feedback.trim() || isProcessing) return;
    
    onSend(feedback);
    setFeedback('');
    setIsOpen(false); // Close after sending
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Only show the bot if there's an uploaded file they can fix
  if (!hasFile) {
    return null;
  }

  return (
    <div className="fixed top-24 left-6 z-50 flex flex-col items-start">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mb-4 w-80 bg-card border border-border shadow-lg rounded-xl overflow-hidden"
          >
            <div className="bg-primary/10 p-3 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">AI Assistant</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Notice any missing lines or incorrect data in the assessment? Tell the AI what to fix and it will re-scan the document.
              </p>
              <div className="relative">
                <Textarea
                  placeholder="e.g. Items between line 2 and 42 are missing..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[80px] resize-none pr-10 text-sm"
                  disabled={isProcessing}
                />
                <Button
                  size="icon"
                  className="absolute bottom-2 right-2 h-6 w-6 rounded-md"
                  onClick={handleSend}
                  disabled={!feedback.trim() || isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-center gap-2 px-4 py-2 rounded-full shadow-md font-medium text-sm transition-colors",
          isOpen ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground border border-border hover:bg-muted"
        )}
      >
        <MessageSquare className="w-4 h-4" />
        Fix Extraction
      </motion.button>
    </div>
  );
}
