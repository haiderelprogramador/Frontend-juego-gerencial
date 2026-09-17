import { Injectable, signal } from '@angular/core';

import { Curso } from '../models/curso.model';

const STORAGE_KEY = 'bizsim.cursos';

@Injectable({ providedIn: 'root' })
export class CursoService {
  private readonly cursosSignal = signal<Curso[]>(this.leerCursos());

  readonly cursos = this.cursosSignal.asReadonly();

  crearCurso(nombre: string, docenteId = 'doc-demo'): Curso {
    const curso: Curso = {
      id: `curso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nombre: nombre.trim(),
      docenteId,
      creadoEn: new Date().toISOString(),
    };
    const cursos = [...this.cursosSignal(), curso];
    this.cursosSignal.set(cursos);
    this.guardarCursos(cursos);
    return curso;
  }

  eliminarCurso(cursoId: string): void {
    const cursos = this.cursosSignal().filter((curso) => curso.id !== cursoId);
    this.cursosSignal.set(cursos);
    this.guardarCursos(cursos);
  }

  modificarNombre(cursoId: string, nombre: string): void {
    const cursos = this.cursosSignal().map((curso) =>
      curso.id === cursoId ? { ...curso, nombre: nombre.trim() } : curso,
    );
    this.cursosSignal.set(cursos);
    this.guardarCursos(cursos);
  }

  private leerCursos(): Curso[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Curso[]) : [];
    } catch {
      return [];
    }
  }

  private guardarCursos(cursos: Curso[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cursos));
  }
}
