# open-doc

A tool for writing documents, such as a resume and a cover letter, as code on A4 pages and exporting them. This glossary covers the language of using it. Words for maintaining the framework underneath it are not defined here.

## Language

**Document**:
A text document of one or more A4 Pages that you write and export. Today it comes in two kinds, a Resume and a Cover letter.
_Avoid_: File, slide, deck

**Resume**:
A one to two page Document presenting a person's experience.
_Avoid_: CV

**Cover letter**:
A one page Document that accompanies a Resume for one application.
_Avoid_: Letter

**Template**:
The untouched placeholder Document of a kind (a Resume or a Cover letter) that ships with the project, copied to begin a real one. A Document you wrote is still a Document, even when you copy it to start the next.
_Avoid_: Starter, sample, slide

**Page**:
One A4 sheet (794 by 1123 pixels) of a Document.
_Avoid_: Slide, sheet

## The files behind a Document

**Brief**:
The target and facts for one role: the job description's keywords, the confirmed experience, the gaps, and the style. The only source of facts for a Resume.
_Avoid_: JD, notes

**Content**:
The Markdown file holding the words of one Document.
_Avoid_: Text, copy, source

**Layout**:
The page file that arranges a Document's Content into Pages and styles it. It carries its own copy of the words.
_Avoid_: Slide, design, render

**Drift**:
Content and Layout saying different things, usually after an edit made directly in the editor.
_Avoid_: Out of sync, mismatch

## Look

**Theme**:
A named look, such as Lars, that a Document follows. It lives in the `themes/` folder and is picked with the Layout's `theme` setting.
_Avoid_: Style, skin, preset

**Design**:
The colors, fonts and sizes of one Document, adjustable in the editor's Design panel. Changing a Design never changes the Theme it follows.
_Avoid_: Style, settings
