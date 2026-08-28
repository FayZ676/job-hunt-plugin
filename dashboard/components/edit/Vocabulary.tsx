"use client";

import { createContext, useContext, type ReactNode } from "react";

export type Vocabularies = { section: string[]; kind: string[]; status: string[] };

const Vocabulary = createContext<Vocabularies>({ section: [], kind: [], status: [] });

export const useVocabulary = () => useContext(Vocabulary);

export const VocabularyProvider = ({ value, children }:
  { value: Vocabularies; children: ReactNode }) =>
  <Vocabulary value={value}>{children}</Vocabulary>;
