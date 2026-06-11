import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Course, Tee } from '@/lib/data/models';
import { useUserId } from '@/lib/auth/provider';
import { uuid } from '@/lib/uuid';

import { fetchCourses } from './api';
import { keys } from './keys';
import { enqueue } from './outbox';
import { queryClient } from './query-client';
import { wireToCourse, wireToTee } from './types';

export type CourseWithTees = Course & { tees: Tee[] };

export function useCourses() {
  const uid = useUserId();
  return useQuery({
    queryKey: keys.courses(uid),
    enabled: uid !== '',
    queryFn: async (): Promise<CourseWithTees[]> => {
      const res = await fetchCourses();
      return res.courses.map((c) => ({ ...wireToCourse(c), tees: c.tees.map(wireToTee) }));
    },
  });
}

function patchCourses(uid: string, fn: (courses: CourseWithTees[]) => CourseWithTees[]) {
  queryClient.setQueryData<CourseWithTees[]>(keys.courses(uid), (prev) => fn(prev ?? []));
}

// Find an existing course by name (case-insensitive, over the cached list) or
// create it — the old findOrCreateCourse, now client-resolved.
export function useEnsureCourse() {
  const uid = useUserId();
  return useCallback(
    async (name: string): Promise<string> => {
      const trimmed = name.trim();
      const courses = queryClient.getQueryData<CourseWithTees[]>(keys.courses(uid)) ?? [];
      const existing = courses.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing.id;

      const course: CourseWithTees = {
        id: uuid(),
        name: trimmed,
        createdAt: new Date().toISOString(),
        tees: [],
      };
      patchCourses(uid, (prev) => [...prev, course]);
      await enqueue({
        method: 'PUT',
        path: `/data/courses/${course.id}`,
        body: { name: trimmed, created_at: course.createdAt },
        touches: [keys.courses(uid)],
      });
      return course.id;
    },
    [uid],
  );
}

export type CreateTeeInput = {
  courseId: string;
  name: string;
  courseRating: number;
  slopeRating: number;
  par?: number | null;
};

export function useCreateTee() {
  const uid = useUserId();
  return useCallback(
    async (input: CreateTeeInput): Promise<string> => {
      const tee: Tee = {
        id: uuid(),
        courseId: input.courseId,
        name: input.name.trim(),
        courseRating: input.courseRating,
        slopeRating: input.slopeRating,
        par: input.par ?? null,
        createdAt: new Date().toISOString(),
      };
      patchCourses(uid, (prev) =>
        prev.map((c) => (c.id === input.courseId ? { ...c, tees: [...c.tees, tee] } : c)),
      );
      await enqueue({
        method: 'PUT',
        path: `/data/tees/${tee.id}`,
        body: {
          course_id: tee.courseId,
          name: tee.name,
          course_rating: tee.courseRating,
          slope_rating: tee.slopeRating,
          par: tee.par,
          created_at: tee.createdAt,
        },
        touches: [keys.courses(uid)],
      });
      return tee.id;
    },
    [uid],
  );
}
