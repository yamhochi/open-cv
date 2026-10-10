# open-cv

A tool for writing a resume and cover letter as code on A4 pages, tailoring them to roles, and exporting them. This glossary covers the language of using it. Words for maintaining the framework underneath it are not defined here.

## Language

**Resume**:
A one to two page A4 document presenting a person's experience, tailored to one role.
_Avoid_: CV, document, slide

**Cover letter**:
A one page A4 letter that accompanies a resume for one application.
_Avoid_: Letter, document, slide

**Template**:
The untouched placeholder Resume or Cover letter that ships with the project, copied to begin a real one. A Resume you tailored is still a Resume, even when you copy it to start the next.
_Avoid_: Starter, sample, slide

**Page**:
One A4 sheet (794 by 1123 pixels) of a Resume or Cover letter.
_Avoid_: Slide, sheet

## The files behind a Resume

**Brief**:
The target and facts for one role: the job description's keywords, the confirmed experience, the gaps, and the style. The only source of facts for a Resume.
_Avoid_: JD, notes

**Content**:
The Markdown file holding the words of one Resume or Cover letter.
_Avoid_: Text, copy, source, resume file

**Layout**:
The page file that arranges a Resume's or Cover letter's Content into Pages and styles it. It carries its own copy of the words.
_Avoid_: Slide, design, render

**Drift**:
Content and Layout saying different things, usually after an edit made directly in the editor.
_Avoid_: Out of sync, mismatch

## Look

**Theme**:
A named look, such as Lars, that a Resume or Cover letter follows. It lives in the `themes/` folder and is picked with the Layout's `theme` setting.
_Avoid_: Style, skin, preset

**Design**:
The colors, fonts and sizes of one Resume or Cover letter, adjustable in the editor's Design panel. Changing a Design never changes the Theme it follows.
_Avoid_: Style, settings
