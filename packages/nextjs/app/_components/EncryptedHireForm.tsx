"use client";

import { useEffect, useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { Briefcase, ChevronRight, DollarSign, Layers, User } from "lucide-react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useEncryptedHireForm } from "~~/hooks/useEncryptedHireForm";

export const EncryptedHireForm = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;
  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);

  const initialMockChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });
  const form = useEncryptedHireForm({ instance: fhevmInstance, initialMockChains });

  const [answers, setAnswers] = useState({ q1: "", q2: "", q3: "", q4: "" });
  const [decryptedAnswers, setDecryptedAnswers] = useState<{ [key: string]: string }>({});
  const [step, setStep] = useState(0);
  const allAnswered = answers.q1 && answers.q2 && answers.q3 && answers.q4;

  const handleSelect = (q: keyof typeof answers, val: string) => {
    setAnswers(a => ({ ...a, [q]: val }));
  };

  const handleNext = () => setStep(prev => Math.min(prev + 1, 4));

  const handleSubmit = async () => {
    const answerString = `${answers.q1}${answers.q2}${answers.q3}${answers.q4}`;
    await form.submitSubmission(answerString);
  };

  const MAPS = {
    q1: {
      A: "18–25 years old",
      B: "26–35 years old",
      C: "36–45 years old",
      D: "46+ years old",
    },
    q2: {
      A: "Frontend Developer",
      B: "Backend Developer",
      C: "Blockchain Engineer",
      D: "Project Manager",
    },
    q3: {
      A: "Less than 1 year",
      B: "1–3 years",
      C: "3–5 years",
      D: "More than 5 years",
    },
    q4: {
      A: "Under $1000",
      B: "$1000–2000",
      C: "$2000–4000",
      D: "Over $4000",
    },
  };

  useEffect(() => {
    if (form.decryptedString && form.decryptedString.length === 4) {
      const chars = form.decryptedString.split("");
      setDecryptedAnswers({
        q1: chars[0],
        q2: chars[1],
        q3: chars[2],
        q4: chars[3],
      });
    }
  }, [form.decryptedString]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-60px)] w-[100vw] text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Connect your wallet to apply 💼</h2>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  const currentAnswer = step === 0 ? answers.q1 : step === 1 ? answers.q2 : step === 2 ? answers.q3 : answers.q4;

  if (form.hasSubmitted) {
    const useDecrypted = !!form.decryptedString;
    const displayAnswers = useDecrypted ? decryptedAnswers : answers;

    return (
      <div className="w-[780px] h-[calc(100vh-60px)] mx-auto flex flex-col justify-center px-6 py-10 text-gray-900">
        <div className="text-center">
          <Briefcase className="w-10 h-10 mx-auto text-yellow-500 mb-2" />
          <h1 className="text-3xl font-bold mb-2">Encrypted Hire Form</h1>
          <p className="text-gray-600">Your answers are encrypted using FHE 🔐</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border text-center space-y-5 mt-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            {useDecrypted ? "📝 Decrypted Answers" : "📝 Review Your Answers"}
          </h3>

          <div className="space-y-3 text-left max-w-lg mx-auto">
            <ReviewItem index="1️⃣" question="Your age range" answerLabel={displayAnswers.q1} map={MAPS.q1} />
            <ReviewItem index="2️⃣" question="Position applied for" answerLabel={displayAnswers.q2} map={MAPS.q2} />
            <ReviewItem index="3️⃣" question="Years of experience" answerLabel={displayAnswers.q3} map={MAPS.q3} />
            <ReviewItem index="4️⃣" question="Expected salary" answerLabel={displayAnswers.q4} map={MAPS.q4} />
          </div>

          {!form.decryptedString && (
            <button
              onClick={form.decrypt}
              disabled={form.isProcessing}
              className="mt-2 mb-2 w-[512px] px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-300 font-semibold shadow-md hover:scale-105 transition-all disabled:opacity-50"
            >
              {form.isProcessing ? "🔄 Decrypting..." : "🔓 Decrypt My Response"}
            </button>
          )}

          {form.decryptedString && (
            <div className="w-[512px] ml-[84px] mt-4 p-3 bg-yellow-50 border rounded-xl shadow text-gray-800">
              <p className="font-mono text-sm">✅ Decrypted: {form.decryptedString}</p>
            </div>
          )}
        </div>

        {form.message && <p className="text-center text-gray-500 italic mt-4">{form.message}</p>}
      </div>
    );
  }

  return (
    <div className="w-[780px] h-[calc(100vh-60px)] mx-auto flex flex-col justify-center px-6 py-10 text-gray-900">
      <div className="text-center">
        <Briefcase className="w-10 h-10 mx-auto text-yellow-500 mb-2" />
        <h1 className="text-3xl font-bold mb-2">Encrypted Hire Form</h1>
        <p className="text-gray-600">Answer privately — your data is encrypted using FHE 🔐</p>
      </div>

      {step === 0 &&
        renderQuestion(
          "Your age range",
          <User className="w-6 h-6 text-yellow-500" />,
          ["A", "B", "C", "D"],
          ["18–25", "26–35", "36–45", "46+"],
          answers.q1,
          v => handleSelect("q1", v),
          form.hasSubmitted,
        )}
      {step === 1 &&
        renderQuestion(
          "Position you're applying for",
          <Briefcase className="w-6 h-6 text-yellow-500" />,
          ["A", "B", "C", "D"],
          ["Frontend Developer", "Backend Developer", "Blockchain Engineer", "Project Manager"],
          answers.q2,
          v => handleSelect("q2", v),
          form.hasSubmitted,
        )}
      {step === 2 &&
        renderQuestion(
          "Years of experience",
          <Layers className="w-6 h-6 text-yellow-500" />,
          ["A", "B", "C", "D"],
          ["<1 year", "1–3 years", "3–5 years", "5+ years"],
          answers.q3,
          v => handleSelect("q3", v),
          form.hasSubmitted,
        )}
      {step === 3 &&
        renderQuestion(
          "Expected salary range",
          <DollarSign className="w-6 h-6 text-yellow-500" />,
          ["A", "B", "C", "D"],
          ["<$1000", "$1000–2000", "$2000–4000", "$4000+"],
          answers.q4,
          v => handleSelect("q4", v),
          form.hasSubmitted,
        )}

      <div className="flex justify-end mt-6">
        {step < 4 && (
          <button
            onClick={handleNext}
            disabled={!currentAnswer}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-md transition-all
              bg-gradient-to-r from-yellow-400 to-amber-300 text-gray-900
              hover:scale-105 active:scale-95
              ${!currentAnswer ? "opacity-60 cursor-not-allowed hover:scale-100 active:scale-100" : ""}`}
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {step === 4 && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border text-center space-y-5">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">📝 Review Your Answers</h3>

          <div className="space-y-3 text-left max-w-lg mx-auto">
            <ReviewItem index="1️⃣" question="Your age range" answerLabel={answers.q1} map={MAPS.q1} />
            <ReviewItem index="2️⃣" question="Position applied for" answerLabel={answers.q2} map={MAPS.q2} />
            <ReviewItem index="3️⃣" question="Years of experience" answerLabel={answers.q3} map={MAPS.q3} />
            <ReviewItem index="4️⃣" question="Expected salary" answerLabel={answers.q4} map={MAPS.q4} />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!allAnswered || form.isProcessing}
            className={`w-[512px] mb-5 px-6 py-3 rounded-xl font-semibold shadow-md transition-all
              bg-gradient-to-r from-yellow-400 to-amber-300 text-gray-900
              hover:scale-105 active:scale-95
              ${!allAnswered ? "opacity-60 cursor-not-allowed hover:scale-100 active:scale-100" : ""}`}
          >
            {form.isProcessing ? "⏳ Submitting..." : "🚀 Submit My Application"}
          </button>
        </div>
      )}
    </div>
  );
};

function ReviewItem({
  index,
  question,
  answerLabel,
  map,
}: {
  index: string;
  question: string;
  answerLabel: string;
  map: Record<string, string>;
}) {
  const answerText = answerLabel ? `${answerLabel} (${map[answerLabel]})` : "—";
  return (
    <div className="p-3 border rounded-lg bg-yellow-50 flex items-center">
      <span className="font-bold mr-2">{index}</span>
      <div>
        <strong>{question}:</strong> <span className="ml-1 text-gray-800">{answerText}</span>
      </div>
    </div>
  );
}

function renderQuestion(
  title: string,
  icon: React.ReactNode,
  labels: string[],
  options: string[],
  selected: string,
  onSelect: (val: string) => void,
  disabled: boolean,
) {
  return (
    <div className="bg-[#fffaf1] border border-yellow-100 p-6 rounded-2xl shadow-lg text-center transition-all mt-10">
      <div className="flex justify-center items-center gap-2 mb-3">
        <div className="relative bottom-1">{icon}</div>
        <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((opt, i) => {
          const label = labels[i];
          const active = selected === label;
          return (
            <button
              key={label}
              onClick={() => onSelect(label)}
              disabled={disabled}
              className={`p-4 rounded-xl border text-left font-medium transition-all ${
                active
                  ? "bg-yellow-300 border-yellow-500 text-gray-900 shadow-inner"
                  : "bg-white border-gray-200 hover:bg-yellow-50 hover:border-yellow-200"
              }`}
            >
              <strong className="mr-2">{label}.</strong> {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
