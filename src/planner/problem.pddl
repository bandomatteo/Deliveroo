define (problem deliveroo-problem)
  (:domain deliveroo)

;; Objects
  (:objects
    a1 - agent
    p1 p2 - parcel
    c1 c2 c3 c4 c5 - cell)

  ;; Relazioni tra celle (adiacenza), da prendere dinamicamente xd
  (:init
    (adjacent c1 c2) (adjacent c2 c3) ...)

  ;; Celle base e posizione iniziale dei pacchi da prendere dinamicamente
  (:init
    (base c5)
    (parcel-at p1 c2)
    (parcel-at p2 c3)
    (at a1 c1))

  ;; obiettivo: Consegna di tutti i pacchi
  (:goal (and (delivered p1) (delivered p2)))
)